import request from 'supertest';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import { app, server, io } from '../index';
import { query } from '../utils/database';
import { UserService } from '../models/User';
import {
  truncateAll,
  seedUser,
  createCategoryFor,
  setBudgetFor,
  currentYearMonth,
  SeededUser
} from './helpers';

let serverPort: number;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      serverPort = addr.port;
      resolve();
    });
  });
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  await truncateAll();
});

describe('SSO login (mocked, no real network)', () => {
  test('UserService.findOrCreate creates a user keyed by provider + provider_user_id', async () => {
    const a = await UserService.findOrCreate('google', 'google-id-1', {
      email: 'shared@example.com',
      displayName: 'Alice'
    });
    expect(a).toMatchObject({ provider: 'google', provider_user_id: 'google-id-1' });

    // Same provider+id → same user (no duplicate).
    const aAgain = await UserService.findOrCreate('google', 'google-id-1', {
      email: 'shared@example.com',
      displayName: 'Alice Renamed'
    });
    expect(aAgain.id).toBe(a.id);

    // Same email, different provider → separate account (per spec, no email-based linking).
    const b = await UserService.findOrCreate('github', 'github-id-1', {
      email: 'shared@example.com',
      displayName: 'Alice'
    });
    expect(b.id).not.toBe(a.id);
    expect(b.provider).toBe('github');
  });

  test('a JWT signed for a seeded user is accepted by /auth/me', async () => {
    const user = await seedUser({ provider: 'google', providerUserId: 'gid-me' });
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.provider).toBe('google');
  });

  test('/api/categories rejects requests without a token', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Access token required');
  });
});

describe('Categories', () => {
  let user: SeededUser;
  beforeEach(async () => {
    user = await seedUser();
  });

  test('creates a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Groceries' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Groceries');
  });

  test('rejects empty name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  test('rejects duplicate category name for the same user', async () => {
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Rent' })
      .expect(201);
    const dup = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Rent' });
    expect(dup.status).toBe(409);
  });
});

describe('Transactions', () => {
  let user: SeededUser;
  let categoryId: string;

  beforeEach(async () => {
    user = await seedUser();
    const cat = await createCategoryFor(user.id, 'Food');
    categoryId = cat.id;
  });

  test('creates a valid transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Lunch',
        amount: 12.5,
        category_id: categoryId,
        transaction_date: '2026-05-12'
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Lunch');
    expect(parseFloat(res.body.amount)).toBe(12.5);
  });

  test('rejects amount <= 0', async () => {
    for (const bad of [0, -1, -100]) {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          title: 'Bad',
          amount: bad,
          category_id: categoryId,
          transaction_date: '2026-05-12'
        });
      expect(res.status).toBe(400);
    }
  });

  test('rejects empty title', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: '', amount: 5, category_id: categoryId, transaction_date: '2026-05-12' });
    expect(res.status).toBe(400);
  });

  test('rejects missing date', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'No date', amount: 5, category_id: categoryId });
    expect(res.status).toBe(400);
  });

  test('rejects category that belongs to a different user', async () => {
    const otherUser = await seedUser({ providerUserId: 'other-user-xyz' });
    const otherCat = await createCategoryFor(otherUser.id, 'Other Food');

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Cross-tenant attempt',
        amount: 5,
        category_id: otherCat.id,
        transaction_date: '2026-05-12'
      });
    expect(res.status).toBe(400);
  });
});

describe('Cross-user authorization', () => {
  test("user B cannot see, update, or delete user A's category", async () => {
    const userA = await seedUser({ providerUserId: 'A' });
    const userB = await seedUser({ providerUserId: 'B' });
    const catA = await createCategoryFor(userA.id, 'A-only');

    // List as B should not include A's category.
    const list = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(list.status).toBe(200);
    expect(list.body.find((c: any) => c.id === catA.id)).toBeUndefined();

    // Update as B should 404 (the WHERE clause is scoped by user_id).
    const upd = await request(app)
      .put(`/api/categories/${catA.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ name: 'hijacked' });
    expect(upd.status).toBe(404);

    // Delete as B should 404.
    const del = await request(app)
      .delete(`/api/categories/${catA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(del.status).toBe(404);

    // A's category should still exist with its original name.
    const stillThere = await query(
      'SELECT name FROM categories WHERE id = $1',
      [catA.id]
    );
    expect(stillThere.rows[0].name).toBe('A-only');
  });

  test("user B cannot update or delete user A's transaction", async () => {
    const userA = await seedUser({ providerUserId: 'A2' });
    const userB = await seedUser({ providerUserId: 'B2' });
    const catA = await createCategoryFor(userA.id, 'A-cat');
    const catB = await createCategoryFor(userB.id, 'B-cat');

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'A-tx',
        amount: 10,
        category_id: catA.id,
        transaction_date: '2026-05-01'
      })
      .expect(201);
    const txId = create.body.id;

    const upd = await request(app)
      .put(`/api/transactions/${txId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        title: 'pwned',
        amount: 1,
        category_id: catB.id,
        transaction_date: '2026-05-02'
      });
    expect(upd.status).toBe(404);

    const del = await request(app)
      .delete(`/api/transactions/${txId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(del.status).toBe(404);
  });
});

describe('WebSocket budget alerts', () => {
  const connectSocket = (token: string): Promise<ClientSocket> =>
    new Promise((resolve, reject) => {
      const sock = ioClient(`http://localhost:${serverPort}`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true
      });
      sock.on('connect', () => resolve(sock));
      sock.on('connect_error', (err) => reject(err));
    });

  const collectAlerts = (
    sock: ClientSocket,
    expectedCount: number,
    timeoutMs = 1500
  ): Promise<any[]> =>
    new Promise((resolve) => {
      const received: any[] = [];
      const timer = setTimeout(() => resolve(received), timeoutMs);
      sock.on('budget_alert', (msg) => {
        received.push(msg);
        if (received.length >= expectedCount) {
          clearTimeout(timer);
          resolve(received);
        }
      });
    });

  test('fires 50 / 80 / 100 thresholds exactly once per month, even after edits', async () => {
    const user = await seedUser({ providerUserId: 'ws-thresholds' });
    const cat = await createCategoryFor(user.id, 'Daily');
    const { year, month } = currentYearMonth();
    await setBudgetFor(user.id, year, month, 100);

    const sock = await connectSocket(user.token);
    const isoDate = `${year}-${String(month).padStart(2, '0')}-01`;

    // Drain any alerts emitted on connect (none expected: budget exists but $0 spent).
    await new Promise((r) => setTimeout(r, 100));

    // 50% — post a $50 transaction, expect one alert.
    const alerts50P = collectAlerts(sock, 1);
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 't1', amount: 50, category_id: cat.id, transaction_date: isoDate })
      .expect(201);
    const alerts50 = await alerts50P;
    expect(alerts50.map((a) => a.threshold)).toEqual([50]);

    // 80% — post a $30 transaction, expect one new alert (80 only).
    const alerts80P = collectAlerts(sock, 1);
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 't2', amount: 30, category_id: cat.id, transaction_date: isoDate })
      .expect(201);
    const alerts80 = await alerts80P;
    expect(alerts80.map((a) => a.threshold)).toEqual([80]);

    // 100% — post a $20 transaction, expect one new alert (100 only).
    const alerts100P = collectAlerts(sock, 1);
    const txAt100 = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 't3', amount: 20, category_id: cat.id, transaction_date: isoDate })
      .expect(201);
    const alerts100 = await alerts100P;
    expect(alerts100.map((a) => a.threshold)).toEqual([100]);

    // Edit a transaction — already-fired thresholds must NOT re-fire.
    const noNewAlertsP = collectAlerts(sock, 5, 800);
    await request(app)
      .put(`/api/transactions/${txAt100.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 't3-edited',
        amount: 25,
        category_id: cat.id,
        transaction_date: isoDate
      })
      .expect(200);
    const noNewAlerts = await noNewAlertsP;
    expect(noNewAlerts).toEqual([]);

    // Verify DB recorded each threshold exactly once.
    const recorded = await query(
      'SELECT threshold FROM budget_alerts WHERE user_id = $1 AND year = $2 AND month = $3 ORDER BY threshold',
      [user.id, year, month]
    );
    expect(recorded.rows.map((r) => r.threshold)).toEqual([50, 80, 100]);

    sock.disconnect();
  });

  test('does not fire any alert when no budget is set for the month', async () => {
    const user = await seedUser({ providerUserId: 'ws-no-budget' });
    const cat = await createCategoryFor(user.id, 'Daily');
    const { year, month } = currentYearMonth();
    // No budget set on purpose.

    const sock = await connectSocket(user.token);
    const drainP = collectAlerts(sock, 5, 800);

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'expensive',
        amount: 9999,
        category_id: cat.id,
        transaction_date: `${year}-${String(month).padStart(2, '0')}-15`
      })
      .expect(201);

    const drained = await drainP;
    expect(drained).toEqual([]);

    sock.disconnect();
  });
});

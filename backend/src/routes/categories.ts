import express from 'express';
import { query } from '../utils/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all categories for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM categories WHERE user_id = $1 ORDER BY name',
      [req.user!.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category
router.post('/', async (req: AuthRequest, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const { rows } = await query(
      'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user!.id, name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: 'Category name already exists' });
    } else {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
});

// Update category
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const { rows } = await query(
      'UPDATE categories SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [name.trim(), id, req.user!.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: 'Category name already exists' });
    } else {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  }
});

// Delete category (reassign transactions to "Uncategorized")
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    // Check if category exists and belongs to user
    const { rows: categoryRows } = await query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (categoryRows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get or create "Uncategorized" category
    const { rows: uncategorizedRows } = await query(
      'SELECT * FROM categories WHERE user_id = $1 AND name = $2',
      [req.user!.id, 'Uncategorized']
    );

    let uncategorizedId = uncategorizedRows[0]?.id;

    if (!uncategorizedId) {
      const { rows: newUncategorized } = await query(
        'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id',
        [req.user!.id, 'Uncategorized']
      );
      uncategorizedId = newUncategorized[0].id;
    }

    // Reassign transactions to "Uncategorized"
    await query(
      'UPDATE transactions SET category_id = $1 WHERE category_id = $2 AND user_id = $3',
      [uncategorizedId, id, req.user!.id]
    );

    // Delete the category
    await query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, req.user!.id]);

    res.json({ message: 'Category deleted and transactions reassigned to Uncategorized' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
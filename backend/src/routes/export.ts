import { Router, Request, Response } from 'express';
import { getGoal } from '../domain/userGoal';
import { generateSampleHistory, DEMO_ANCHOR_DATE } from '../domain/sampleData';
import { buildWeightData } from '../domain/weight';
import { buildFoodDay } from '../domain/foodLog';

const router = Router();

router.get('/export', (req: Request, res: Response) => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format : 'json';
    const goal = getGoal();
    const weight = buildWeightData(90);
    const foodDay = buildFoodDay(DEMO_ANCHOR_DATE);

    const data = {
      exportedAt: new Date().toISOString(),
      demoDate: DEMO_ANCHOR_DATE,
      goal,
      weight,
      food: foodDay,
    };

    if (format === 'csv') {
      const rows: string[] = ['type,date,item,calories,protein,carbs,fat'];
      for (const meal of foodDay.groups) {
        for (const entry of meal.entries) {
          rows.push(
            `food,${entry.date},${entry.name},${entry.calories},${entry.protein},${entry.carbs},${entry.fat}`,
          );
        }
      }
      for (const point of weight.series) {
        rows.push(`weight,${point.date},${point.scale ?? ''},${point.trend},,,\n`);
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="fuel-export.csv"');
      res.status(200).send(rows.join('\n'));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="fuel-export.json"');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

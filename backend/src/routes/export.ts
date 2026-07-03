import { Router, Request, Response } from 'express';
import { getGoal } from '../domain/userGoal';
import { buildWeightData } from '../domain/weight';
import { buildFoodDay, getAllLogDates } from '../domain/foodLog';
import { DEMO_ANCHOR_DATE } from '../domain/sampleData';

const router = Router();

router.get('/export', (req: Request, res: Response) => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format : 'json';
    const goal = getGoal();
    const weight = buildWeightData(180); // max WeightRange
    const logDates = getAllLogDates();
    // Always include demo anchor if no real dates logged
    const dates = logDates.length > 0 ? logDates : [DEMO_ANCHOR_DATE];
    const foodDays = dates.map((d) => buildFoodDay(d));

    if (format === 'csv') {
      const rows: string[] = ['type,date,item,calories,protein,carbs,fat'];
      for (const day of foodDays) {
        for (const meal of day.groups) {
          for (const entry of meal.entries) {
            const safeName = `"${entry.name.replace(/"/g, '""')}"`;
            rows.push(
              `food,${entry.date},${safeName},${entry.calories},${entry.protein},${entry.carbs},${entry.fat}`,
            );
          }
        }
      }
      for (const point of weight.series) {
        rows.push(`weight,${point.date},,${point.scale ?? ''},${point.trend},,,`);
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="fuel-export.csv"');
      res.status(200).send(rows.join('\n'));
      return;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      goal,
      weight: {
        series: weight.series,
        stats: weight.stats,
      },
      foodLog: foodDays.map((day) => ({
        date: day.date,
        consumed: day.consumed,
        meals: day.groups.map((g) => ({
          slot: g.slot,
          totals: g.totals,
          entries: g.entries,
        })),
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="fuel-export.json"');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

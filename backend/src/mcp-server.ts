/**
 * MCP Server for Nutrition App
 *
 * Exposes the nutrition tracking system as a Model Context Protocol server.
 * Connect from Claude Desktop, VS Code Copilot, Cursor, or any MCP client.
 *
 * Usage (stdio transport):
 *   node dist/mcp-server.js
 *
 * Or via HTTP (SSE) — add MCP_PORT env var:
 *   MCP_PORT=3002 node dist/mcp-server.js
 *
 * Add to Claude Desktop's config:
 * {
 *   "mcpServers": {
 *     "nutrition": {
 *       "command": "node",
 *       "args": ["C:/Users/spamk/nutrition-app/backend/dist/mcp-server.js"],
 *       "env": { "GEMINI_API_KEY": "..." }
 *     }
 *   }
 * }
 */

import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { MealSlot } from '@nutrition/types';

import { buildDemoDashboard } from './domain/dashboard';
import { logFood, deleteLoggedFood, buildFoodDay } from './domain/foodLog';
import { searchFoodsLive } from './domain/foodSearch';
import { getFoodById } from './domain/foodDb';
import { getGoal, setGoal } from './domain/userGoal';
import { buildCoach } from './domain/coach';
import { generateSampleHistory, DEMO_ANCHOR_DATE } from './domain/sampleData';
import { computeWeightTrend } from './domain/energyModel';
import { estimateEtaWeeks } from './domain/goals';
import { logWeight as logWeightDomain } from './domain/weight';
import { chatWithCoach, isCoachEnabled } from './domain/geminiCoach';

const VALID_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function today(): string {
  return DEMO_ANCHOR_DATE;
}

const server = new Server(
  { name: 'nutrition-coach', version: '1.0.0' },
  {
    capabilities: { tools: {} },
  },
);

/* ------------------------------------------------------------------- Tools */

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_dashboard',
      description: 'Get today\'s nutrition dashboard: calories, macros, weight trend, meal log, energy balance, adherence.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_goal',
      description: 'Get the user\'s current nutrition goal: mode (fat-loss/maintenance/lean-bulk/recomp), target weight, start weight, ETA.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'set_goal',
      description: 'Set a new nutrition goal.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['fat-loss', 'maintenance', 'lean-bulk', 'recomp'],
            description: 'Goal mode.',
          },
          targetWeight: { type: 'number', description: 'Target body weight in kg.' },
          startWeight: { type: 'number', description: 'Starting body weight in kg (optional).' },
          startDate: { type: 'string', description: 'Start date ISO (optional). Defaults to today.' },
        },
        required: ['mode', 'targetWeight'],
      },
    },
    {
      name: 'get_coach_briefing',
      description: 'Get the AI coach\'s full analysis: headline, summary, check-in stats, targets, recommendations based on all training data.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'chat_with_coach',
      description: 'Chat with the brutal AI coach. Can log food via natural language ("I had 2 eggs for breakfast"). Requires GEMINI_API_KEY.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to send to the coach.' },
        },
        required: ['message'],
      },
    },
    {
      name: 'search_foods',
      description: 'Search the food database (local + Open Food Facts + USDA). Returns up to 10 matching foods with macros.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Food name to search for.' },
          limit: { type: 'number', description: 'Max results (default: 10).' },
        },
        required: ['query'],
      },
    },
    {
      name: 'log_food',
      description: 'Log a food item to the nutrition diary.',
      inputSchema: {
        type: 'object',
        properties: {
          foodName: { type: 'string', description: 'Name of the food to search and log.' },
          slot: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
            description: 'Meal slot.',
          },
          quantity: { type: 'number', description: 'Number of servings (default: 1).' },
          date: { type: 'string', description: `ISO date (default: ${today()}).` },
        },
        required: ['foodName', 'slot'],
      },
    },
    {
      name: 'get_food_log',
      description: 'Get all logged foods for a given date.',
      inputSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: `ISO date (default: ${today()}).` },
        },
      },
    },
    {
      name: 'log_weight',
      description: 'Log a body weight measurement.',
      inputSchema: {
        type: 'object',
        properties: {
          weight: { type: 'number', description: 'Weight in kg.' },
          date: { type: 'string', description: `ISO date (default: ${today()}).` },
        },
        required: ['weight'],
      },
    },
    {
      name: 'get_progress',
      description: 'Get weight trend analysis: smoothed trend, weekly rate, ETA to goal, progress percentage.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

/* ------------------------------------------------------------- Call handler */

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_dashboard': {
        const dashboard = buildDemoDashboard();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              date: dashboard.date,
              calories: dashboard.calories,
              macros: {
                protein: dashboard.macros.protein,
                carbs: dashboard.macros.carbs,
                fat: dashboard.macros.fat,
              },
              energy: dashboard.energy,
              weeklyAdherence: `${Math.round(dashboard.weeklyAdherence * 100)}%`,
              goal: dashboard.goal,
              meals: dashboard.meals,
            }, null, 2),
          }],
        };
      }

      case 'get_goal': {
        const goal = getGoal();
        const history = generateSampleHistory();
        const trendPoints = computeWeightTrend(history);
        const currentWeight = trendPoints.length > 0
          ? trendPoints[trendPoints.length - 1].trend
          : goal.startWeight;
        const eta = estimateEtaWeeks(currentWeight, goal.targetWeight, trendPoints);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...goal,
              currentWeight: parseFloat(currentWeight.toFixed(1)),
              etaWeeks: eta != null ? Math.round(eta) : null,
              progressKg: parseFloat((goal.startWeight - currentWeight).toFixed(1)),
              remainingKg: parseFloat((currentWeight - goal.targetWeight).toFixed(1)),
            }, null, 2),
          }],
        };
      }

      case 'set_goal': {
        const { mode, targetWeight, startWeight, startDate } = args as {
          mode: 'fat-loss' | 'maintenance' | 'lean-bulk' | 'recomp';
          targetWeight: number;
          startWeight?: number;
          startDate?: string;
        };
        const saved = setGoal({ mode, targetWeight, startWeight, startDate });
        return {
          content: [{ type: 'text', text: `Goal set: ${JSON.stringify(saved, null, 2)}` }],
        };
      }

      case 'get_coach_briefing': {
        const goal = getGoal();
        const history = generateSampleHistory();
        const briefing = buildCoach(history, {
          mode: goal.mode,
          targetWeight: goal.targetWeight,
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              headline: briefing.headline,
              summary: briefing.summary,
              focus: briefing.focus,
              confidence: `${Math.round(briefing.confidence * 100)}%`,
              checkIn: briefing.checkIn,
              targets: briefing.targets,
              recommendations: briefing.recommendations,
              talkingPoints: briefing.talkingPoints,
            }, null, 2),
          }],
        };
      }

      case 'chat_with_coach': {
        const { message } = args as { message: string };
        if (!isCoachEnabled()) {
          return {
            content: [{
              type: 'text',
              text: 'Coach unavailable. Set the GEMINI_API_KEY environment variable.',
            }],
          };
        }
        const reply = await chatWithCoach(message, []);
        return { content: [{ type: 'text', text: reply }] };
      }

      case 'search_foods': {
        const { query, limit = 10 } = args as { query: string; limit?: number };
        const results = await searchFoodsLive(query, limit);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results.map((f) => ({
              id: f.id,
              name: f.name,
              brand: f.brand,
              calories: f.calories,
              protein: f.protein,
              carbs: f.carbs,
              fat: f.fat,
              servingSize: f.servingSize,
              servingUnit: f.servingUnit,
            })), null, 2),
          }],
        };
      }

      case 'log_food': {
        const {
          foodName,
          slot,
          quantity = 1,
          date: dateArg,
        } = args as { foodName: string; slot: MealSlot; quantity?: number; date?: string };

        if (!VALID_SLOTS.includes(slot)) {
          return { content: [{ type: 'text', text: `Invalid slot "${slot}". Use: breakfast, lunch, dinner, snack.` }] };
        }

        const results = await searchFoodsLive(foodName, 5);
        if (results.length === 0) {
          return { content: [{ type: 'text', text: `No food found matching "${foodName}".` }] };
        }

        const match = results.find((f) =>
          f.name.toLowerCase() === foodName.toLowerCase(),
        ) ?? results[0];

        const food = getFoodById(match.id);
        if (!food) {
          return { content: [{ type: 'text', text: `Couldn't resolve food "${match.name}".` }] };
        }

        const date = dateArg ?? today();
        const entry = logFood(date, slot, food.id, quantity, new Date().toISOString());
        return {
          content: [{
            type: 'text',
            text: `Logged: ${entry.quantity}x "${entry.name}" to ${entry.slot} on ${date}\n${entry.calories} kcal | P:${entry.protein}g C:${entry.carbs}g F:${entry.fat}g`,
          }],
        };
      }

      case 'get_food_log': {
        const { date = today() } = (args ?? {}) as { date?: string };
        const day = buildFoodDay(date);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              date: day.date,
          totalCalories: day.consumed.calories,
          totalProtein: day.consumed.protein,
          totalCarbs: day.consumed.carbs,
          totalFat: day.consumed.fat,
              meals: day.groups.map((g) => ({
                slot: g.slot,
                calories: g.totals.calories,
                items: g.entries.map((e) => ({
                  name: e.name,
                  quantity: e.quantity,
                  calories: e.calories,
                  protein: e.protein,
                  carbs: e.carbs,
                  fat: e.fat,
                })),
              })),
            }, null, 2),
          }],
        };
      }

      case 'log_weight': {
        const { weight, date: dateArg } = args as { weight: number; date?: string };
        const date = dateArg ?? today();
        logWeightDomain({ date, weight });
        return {
          content: [{
            type: 'text',
            text: `Weight logged: ${weight} kg on ${date}`,
          }],
        };
      }

      case 'get_progress': {
        const goal = getGoal();
        const history = generateSampleHistory();
        const trendPoints = computeWeightTrend(history);
        const currentWeight = trendPoints.length > 0
          ? trendPoints[trendPoints.length - 1].trend
          : goal.startWeight;

        // Weekly rate (last 4 weeks)
        const fourWeeksAgo = trendPoints[Math.max(0, trendPoints.length - 29)];
        const weeklyRate = fourWeeksAgo
          ? ((currentWeight - fourWeeksAgo.trend) / 4)
          : 0;

        const eta = estimateEtaWeeks(currentWeight, goal.targetWeight, trendPoints);
        const totalNeeded = Math.abs(goal.startWeight - goal.targetWeight);
        const achieved = Math.abs(goal.startWeight - currentWeight);
        const progressPct = totalNeeded > 0 ? Math.min(100, (achieved / totalNeeded) * 100) : 100;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              currentWeight: parseFloat(currentWeight.toFixed(1)),
              targetWeight: goal.targetWeight,
              startWeight: goal.startWeight,
              progressKg: parseFloat(achieved.toFixed(1)),
              progressPct: `${progressPct.toFixed(1)}%`,
              weeklyRateKg: parseFloat(weeklyRate.toFixed(2)),
              etaWeeks: eta != null ? Math.round(eta) : 'stalled',
              last12WeeksWeightTrend: trendPoints
                .filter((_, i) => i % 7 === 0)
                .slice(-12)
                .map((p) => ({ date: p.date, trend: parseFloat(p.trend.toFixed(1)) })),
            }, null, 2),
          }],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
});

/* --------------------------------------------------------------- Transport */

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport: logs to stderr only (stdout is the MCP protocol channel)
  process.stderr.write('Nutrition MCP server running (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`MCP server failed: ${err}\n`);
  process.exit(1);
});

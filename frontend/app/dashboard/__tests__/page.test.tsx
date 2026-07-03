import { render, screen } from '@testing-library/react';
import type { DashboardData } from '@nutrition/types';
import DashboardPage from '../page';

const mockApiGet = jest.fn();

jest.mock('@/lib/api', () => ({
  apiGet: (path: string) => mockApiGet(path),
}));

function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    date: '2026-07-03',
    calories: { target: 2400, consumed: 1800, remaining: 600 },
    macros: {
      protein: { target: 180, consumed: 120, remaining: 60 },
      carbs: { target: 240, consumed: 200, remaining: 40 },
      fat: { target: 70, consumed: 55, remaining: 15 },
    },
    meals: [
      { id: 1, name: 'Greek yogurt bowl', calories: 420, protein: 35, carbs: 40, fat: 12, time: '08:30' },
      { id: 2, name: 'Chicken & rice', calories: 640, protein: 55, carbs: 70, fat: 14, time: '13:00' },
    ],
    weightSeries: [
      { date: '2026-07-01', scale: 82.1, trend: 82.3 },
      { date: '2026-07-02', scale: null, trend: 82.2 },
      { date: '2026-07-03', scale: 81.9, trend: 82.1 },
    ],
    energy: { expenditureEstimate: 2650, confidence: 0.82, trendDelta: -40 },
    weeklyAdherence: 0.86,
    goal: { mode: 'fat-loss', targetWeightDelta: -6, progress: 0.35, etaWeeks: 9 },
    ...overrides,
  };
}

beforeEach(() => {
  mockApiGet.mockReset();
});

describe('DashboardPage', () => {
  it('shows the skeleton state before data resolves', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<DashboardPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the loaded dashboard header and macro bars', async () => {
    mockApiGet.mockResolvedValue(makeData());
    render(<DashboardPage />);

    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Protein')).toBeInTheDocument();
    expect(screen.getByText('Carbs')).toBeInTheDocument();
    expect(screen.getByText('Fat')).toBeInTheDocument();
    expect(screen.getByText('Weight Trend')).toBeInTheDocument();
    expect(screen.getByText("Today's Meals")).toBeInTheDocument();
  });

  it('fetches the dashboard payload from the API', async () => {
    mockApiGet.mockResolvedValue(makeData());
    render(<DashboardPage />);
    await screen.findByText('Today');
    expect(mockApiGet).toHaveBeenCalledWith('/dashboard');
  });

  it('renders logged meals', async () => {
    mockApiGet.mockResolvedValue(makeData());
    render(<DashboardPage />);

    expect(await screen.findByText('Greek yogurt bowl')).toBeInTheDocument();
    expect(screen.getByText('Chicken & rice')).toBeInTheDocument();
    expect(screen.getByText('2 logged')).toBeInTheDocument();
  });

  it('shows the empty state when no meals are logged', async () => {
    mockApiGet.mockResolvedValue(makeData({ meals: [] }));
    render(<DashboardPage />);

    expect(await screen.findByText(/Nothing logged yet/)).toBeInTheDocument();
  });

  it('renders the error state when the API fails', async () => {
    mockApiGet.mockRejectedValue(new Error('boom'));
    render(<DashboardPage />);

    expect(await screen.findByText(/Couldn't load your dashboard/)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

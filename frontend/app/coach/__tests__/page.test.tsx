import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CoachData } from '@nutrition/types';
import CoachPage from '../page';

const mockApiGet = jest.fn();

jest.mock('@/lib/api', () => ({
  apiGet: (path: string) => mockApiGet(path),
}));

function makeCoach(overrides: Partial<CoachData> = {}): CoachData {
  return {
    generatedAt: '2026-07-03T12:00:00.000Z',
    mode: 'fat-loss',
    headline: 'Steady loss, dialed in.',
    summary: 'Your trend weight is falling at target pace and adherence is high.',
    focus: 'Hold protein above 170g while the deficit does its work.',
    confidence: 0.82,
    checkIn: {
      periodLabel: 'Last 14 days',
      avgIntake: 1980,
      avgExpenditure: 2620,
      energyBalance: -640,
      weightTrendDelta: -0.7,
      adherence: 0.86,
      verdict: 'On track — the deficit is real and sustainable.',
    },
    targets: {
      current: 2000,
      recommended: 1950,
      delta: -50,
      protein: 180,
      carbs: 190,
      fat: 60,
      rationale: 'A small trim keeps loss steady as expenditure adapts.',
    },
    recommendations: [
      {
        id: 'r1',
        tone: 'action',
        category: 'calories',
        title: 'Trim 50 kcal from carbs',
        rationale: 'Expenditure drifted down 40 kcal over two weeks.',
        action: 'Drop one small carb serving at dinner.',
        delta: { label: 'Calories', value: -50, unit: 'kcal' },
        priority: 1,
      },
    ],
    talkingPoints: ['How is sleep trending?', 'Any hunger spikes this week?'],
    ...overrides,
  };
}

beforeEach(() => {
  mockApiGet.mockReset();
});

describe('CoachPage', () => {
  it('shows a skeleton before data resolves', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const { container } = render(<CoachPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('fetches the coach briefing for the default mode', async () => {
    mockApiGet.mockResolvedValue(makeCoach());
    render(<CoachPage />);
    await screen.findByText('AI Coach');
    expect(mockApiGet).toHaveBeenCalledWith('/coach?mode=fat-loss');
  });

  it('renders the grounded briefing content', async () => {
    mockApiGet.mockResolvedValue(makeCoach());
    render(<CoachPage />);

    expect(await screen.findByText('Steady loss, dialed in.')).toBeInTheDocument();
    expect(
      screen.getByText('Hold protein above 170g while the deficit does its work.')
    ).toBeInTheDocument();
    expect(screen.getByText('Trim 50 kcal from carbs')).toBeInTheDocument();
    expect(screen.getByText('How is sleep trending?')).toBeInTheDocument();
  });

  it('refetches when the goal mode changes', async () => {
    mockApiGet.mockResolvedValue(makeCoach());
    render(<CoachPage />);
    await screen.findByText('AI Coach');

    mockApiGet.mockResolvedValue(makeCoach({ mode: 'lean-bulk' }));
    fireEvent.click(screen.getByRole('button', { name: /Lean bulk/i }));

    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith('/coach?mode=lean-bulk')
    );
  });

  it('renders an error banner when the request fails', async () => {
    mockApiGet.mockRejectedValue(new Error('coach offline'));
    render(<CoachPage />);
    expect(await screen.findByText('coach offline')).toBeInTheDocument();
  });
});

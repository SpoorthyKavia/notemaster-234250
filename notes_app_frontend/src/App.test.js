import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Notemaster header', () => {
  render(<App />);
  expect(screen.getByText(/Notemaster/i)).toBeInTheDocument();
  expect(screen.getByText(/local-only/i)).toBeInTheDocument();
});

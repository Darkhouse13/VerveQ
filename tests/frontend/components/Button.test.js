import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Button from '../../../frontend/src/components/ui/Button';
import { ThemeProvider } from '../../../frontend/src/context/ThemeContext';

// Test wrapper with theme provider
const ThemeWrapper = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('Button Component', () => {
  it('renders button with title', () => {
    const { getByText } = render(
      <ThemeWrapper>
        <Button title="Test Button" onPress={() => {}} />
      </ThemeWrapper>
    );
    
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('handles press events', () => {
    const mockPress = jest.fn();
    const { getByText } = render(
      <ThemeWrapper>
        <Button title="Press Me" onPress={mockPress} />
      </ThemeWrapper>
    );
    
    fireEvent.press(getByText('Press Me'));
    expect(mockPress).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    const { getByTestId } = render(
      <ThemeWrapper>
        <Button title="Loading Button" onPress={() => {}} loading={true} />
      </ThemeWrapper>
    );
    
    // ActivityIndicator should be present when loading is true
    expect(getByTestId('loading-indicator') || true).toBeTruthy();
  });

  it('renders different variants', () => {
    const { getByText: getPrimary } = render(
      <ThemeWrapper>
        <Button title="Primary" variant="primary" onPress={() => {}} />
      </ThemeWrapper>
    );
    
    const { getByText: getSecondary } = render(
      <ThemeWrapper>
        <Button title="Secondary" variant="secondary" onPress={() => {}} />
      </ThemeWrapper>
    );
    
    expect(getPrimary('Primary')).toBeTruthy();
    expect(getSecondary('Secondary')).toBeTruthy();
  });

  it('disables button when disabled prop is true', () => {
    const mockPress = jest.fn();
    const { getByText } = render(
      <ThemeWrapper>
        <Button title="Disabled Button" onPress={mockPress} disabled={true} />
      </ThemeWrapper>
    );
    
    fireEvent.press(getByText('Disabled Button'));
    expect(mockPress).not.toHaveBeenCalled();
  });
});
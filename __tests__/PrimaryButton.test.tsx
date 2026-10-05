// Most screens depend on a live Firebase connection (auth state,
// Firestore streams), so full screen tests would need an emulator/mock
// setup. This verifies the theme + a core component render without
// throwing.
import { render, screen } from '@testing-library/react-native';

import { PrimaryButton } from '@/components/Buttons';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

test('PrimaryButton renders its label', async () => {
  await render(
    <ThemeProvider>
      <PrimaryButton label="Sign In" onPress={() => {}} />
    </ThemeProvider>,
  );
  expect(await screen.findByText('Sign In')).toBeTruthy();
});

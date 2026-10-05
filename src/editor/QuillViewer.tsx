import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { DeltaOp } from '@/models/types';
import { useTheme } from '@/theme/ThemeProvider';
import { quillDocument, type QuillMessage } from './quillDocument';

/// Read-only note body: the same Quill page as the editor, so headings,
/// lists, code, links and images look exactly as written. The WebView
/// reports its content height and doesn't scroll itself — it sits inside
/// the screen's ScrollView like any other view. Links open outside the app.
export function QuillViewer({ delta }: { delta: DeltaOp[] }) {
  const { colors } = useTheme();
  const [height, setHeight] = useState(0);

  const html = useMemo(() => quillDocument({ mode: 'read', colors, delta }), [colors, delta]);

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: QuillMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'height') setHeight(msg.height);
    else if (msg.type === 'link' && /^(https?|mailto|tel):/i.test(msg.href)) {
      Linking.openURL(msg.href).catch(() => {});
    }
  };

  return (
    <View style={{ minHeight: 120 }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        scrollEnabled={false}
        // Starts at 1px, not 0 — a zero-height Android WebView may skip layout.
        style={{ height: Math.max(height, 1), backgroundColor: 'transparent' }}
        containerStyle={{ flex: 0 }}
      />
      {height === 0 && (
        <View style={{ position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </View>
  );
}

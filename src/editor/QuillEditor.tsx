import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { forwardRef, Fragment, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { DeltaOp } from '@/models/types';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { inlineJson, quillDocument, type QuillMessage } from './quillDocument';
import { TOOLBAR_GROUPS, type ToolbarButton } from './toolbar';

export interface QuillEditorHandle {
  setContents(delta: DeltaOp[]): void;
  insertImage(url: string): void;
  /// Links the selection (or the link under the cursor) to `url`; with no
  /// selection, inserts `text` linked to `url`. An empty `url` unlinks.
  setLink(url: string, text?: string): void;
  /// Takes focus away from the editor, closing its keyboard.
  blur(): void;
}

/// Rich-text editor: a scrollable native toolbar (configured in
/// toolbar.ts) over Quill 2 running in a WebView. Image and link buttons
/// don't act on their own — they call `onRequestImage` / `onRequestLink`
/// so the screen can show a picker or dialog, then answer through the ref.
/// While the editor has focus, a fixed button at the toolbar's end hides
/// the keyboard (React Native's Keyboard.dismiss() can't reach a WebView).
export const QuillEditor = forwardRef<
  QuillEditorHandle,
  {
    initialDelta?: DeltaOp[];
    placeholder?: string;
    height?: number;
    imageBusy?: boolean;
    onChange: (delta: DeltaOp[], plainText: string) => void;
    onRequestImage: () => void;
    onRequestLink: (currentUrl: string | null) => void;
  }
>(function QuillEditor(
  { initialDelta, placeholder = '', height = 320, imageBusy = false, onChange, onRequestImage, onRequestLink },
  ref,
) {
  const { colors } = useTheme();
  const webview = useRef<WebView>(null);
  const [formats, setFormats] = useState<Record<string, unknown>>({});
  const [focused, setFocused] = useState(false);
  // Latest content, so the page rebuilt on a theme toggle keeps the text.
  const latest = useRef(initialDelta ?? []);

  const call = useCallback((fn: string, ...args: unknown[]) => {
    webview.current?.injectJavaScript(`window.${fn}(${args.map(inlineJson).join(',')});true;`);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setContents(delta) {
        latest.current = delta;
        call('msSetContents', delta);
      },
      insertImage: (url) => call('msInsertImage', url),
      setLink: (url, text) => call('msLink', url, text ?? ''),
      blur: () => call('msBlur'),
    }),
    [call],
  );

  const html = useMemo(
    () => quillDocument({ mode: 'edit', colors, delta: latest.current, placeholder }),
    // Rebuilt only on theme change; content is carried over via `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors],
  );

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: QuillMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'change') {
      latest.current = msg.delta;
      onChange(msg.delta, msg.text);
    } else if (msg.type === 'format') {
      setFormats(msg.formats);
    } else if (msg.type === 'focus') {
      setFocused(msg.focused);
    }
  };

  const press = (button: ToolbarButton) => {
    const { action } = button;
    if (action.kind === 'format') call('msFormat', action.key, action.value);
    else if (action.kind === 'command') call(action.command);
    else if (action.kind === 'image') onRequestImage();
    else onRequestLink(typeof formats.link === 'string' ? formats.link : null);
  };

  return (
    <View style={[styles.box, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
      <View style={styles.toolbarRow}>
        <ScrollView
          horizontal
          style={styles.toolbarScroll}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.toolbar}
        >
          {TOOLBAR_GROUPS.map((group, gi) => (
            <Fragment key={gi}>
              {gi > 0 && <View style={[styles.groupGap, { backgroundColor: colors.divider }]} />}
              {group.map((button) => {
                const on = button.isActive?.(formats) ?? false;
                const busy = button.action.kind === 'image' && imageBusy;
                const fg = on ? '#FFFFFF' : colors.tagSubjectText;
                return (
                  <Pressable
                    key={button.id}
                    accessibilityRole="button"
                    accessibilityLabel={button.label}
                    accessibilityState={{ selected: on, busy }}
                    disabled={busy}
                    onPress={() => press(button)}
                    style={[styles.toolButton, { backgroundColor: on ? colors.accent : colors.tagSubjectFill }]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : button.icon ? (
                      <MaterialIcons name={button.icon} size={18} color={fg} />
                    ) : (
                      <Text style={{ color: fg, fontFamily: fonts.bold, fontSize: 13 }}>{button.text}</Text>
                    )}
                  </Pressable>
                );
              })}
            </Fragment>
          ))}
        </ScrollView>
        {focused && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hide keyboard"
            onPress={() => call('msBlur')}
            style={[styles.toolButton, styles.hideKeyboard, { backgroundColor: colors.tagSubjectFill }]}
          >
            <MaterialIcons name="keyboard-hide" size={18} color={colors.tagSubjectText} />
          </Pressable>
        )}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <View style={[styles.editor, { height }]}>
        <WebView
          ref={webview}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={onMessage}
          style={{ backgroundColor: 'transparent' }}
          hideKeyboardAccessoryView
          keyboardDisplayRequiresUserAction={false}
          nestedScrollEnabled
          scrollEnabled
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center' },
  toolbarScroll: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideKeyboard: { marginLeft: 6, marginRight: 12 },
  groupGap: { width: 1, height: 22, marginLeft: 2, marginRight: 8 },
  divider: { height: 1 },
  editor: { padding: 12 },
});

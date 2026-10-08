import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Text, View } from 'react-native';

import { AppDropdown, AppTextField } from '@/components/Inputs';
import type { Subject } from '@/models/types';
import { SubjectsService } from '@/services/subjectsService';
import { useTheme } from '@/theme/ThemeProvider';

/// The dropdown entry that reveals the "new module name" field.
export const NEW_MODULE = '__new_module__';

/// Module dropdown for the editors: an existing module, or "Add new
/// module" plus a name field. `selection` is a module id, NEW_MODULE, or
/// null; a stale id (module deleted meanwhile) shows as unselected.
export function ModulePicker({
  modules,
  loading,
  selection,
  onSelect,
  newName,
  onNewName,
}: {
  modules: Subject[];
  loading: boolean;
  selection: string | null;
  onSelect: (selection: string) => void;
  newName: string;
  onNewName: (name: string) => void;
}) {
  const { colors, type } = useTheme();
  const value =
    selection === NEW_MODULE || (selection != null && modules.some((s) => s.id === selection)) ? selection : null;
  const label = (id: string) => (id === NEW_MODULE ? 'Add new module' : (modules.find((s) => s.id === id)?.name ?? ''));
  return (
    <>
      <AppDropdown<string>
        value={value}
        items={[...modules.map((s) => s.id), NEW_MODULE]}
        itemLabel={label}
        placeholder={loading ? 'Loading modules…' : 'Select a module'}
        onChange={onSelect}
        renderItem={(id) =>
          id === NEW_MODULE ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="add-circle-outline" size={18} color={colors.accent} />
              <Text style={[type.bodyLarge, { marginLeft: 6, color: colors.accent }]}>Add new module</Text>
            </View>
          ) : (
            <Text style={type.bodyLarge} numberOfLines={1}>
              {label(id)}
            </Text>
          )
        }
      />
      {value === NEW_MODULE && (
        <AppTextField
          value={newName}
          onChangeText={onNewName}
          placeholder="New module name, e.g. Data Structures"
          autoCapitalize="words"
          style={{ marginTop: 10 }}
        />
      )}
    </>
  );
}

/// What the picker's state means for saving: a problem to show, or the
/// module to use (`subjectId` null = find or create one called `name`).
export function moduleChoice(
  modules: Subject[],
  selection: string | null,
  newName: string,
): { problem: string } | { subjectId: string | null; name: string } {
  const match = modules.find((s) => s.id === selection);
  if (match) return { subjectId: match.id, name: match.name };
  if (selection !== NEW_MODULE && selection != null) return { problem: 'Please choose a module.' };
  const name = newName.trim();
  if (name.length === 0) return { problem: 'Please choose or name a module.' };
  return { subjectId: null, name };
}

/// Resolves a `moduleChoice` to a module id and its exact name, reusing a
/// module with the same name if one exists. Needs a connection.
export async function resolveModule(choice: { subjectId: string | null; name: string }) {
  if (choice.subjectId != null) return { subjectId: choice.subjectId, subjectName: choice.name };
  const subjectId = await SubjectsService.findOrCreateSubject(choice.name);
  // Pick up the existing module's exact spelling if one matched.
  const subjectName = (await SubjectsService.getSubject(subjectId))?.name ?? choice.name;
  return { subjectId, subjectName };
}

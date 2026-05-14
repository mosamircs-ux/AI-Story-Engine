import { useListCharacters, useListCharacterLines } from "@workspace/api-client-react";
import type { Character, DialogueLine } from "@workspace/api-client-react";
import { useLocalSearchParams } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

const ROLE_COLORS: Record<string, string> = {
  protagonist: "#C8A428",
  antagonist: "#e63946",
  supporting: "#52b788",
  minor: "#90caf9",
};

function DialogueLineCard({
  line,
  character,
}: {
  line: DialogueLine;
  character?: Character;
}) {
  const colors = useColors();
  const roleColor = character
    ? ROLE_COLORS[character.role] ?? colors.primary
    : colors.primary;

  return (
    <View style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.lineHeader}>
        <View style={[styles.dot, { backgroundColor: roleColor }]} />
        <Text style={[styles.lineName, { color: roleColor }]}>{character?.name ?? "Unknown"}</Text>
        <Text style={[styles.lineChapter, { color: colors.mutedForeground }]}>
          Ch. {line.chapterNumber}
        </Text>
      </View>
      <Text style={[styles.lineText, { color: colors.foreground }]}>"{line.text}"</Text>
      {line.context ? (
        <Text style={[styles.lineContext, { color: colors.mutedForeground }]}>
          {line.context}
        </Text>
      ) : null}
    </View>
  );
}

function CharacterDialogue({
  character,
  novelId,
}: {
  character: Character;
  novelId: number;
}) {
  const { data: lines, isLoading } = useListCharacterLines(character.id);
  const colors = useColors();

  if (isLoading) return <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />;
  if (!lines || lines.length === 0) return null;

  return (
    <FlatList
      data={lines}
      keyExtractor={(l) => String(l.id)}
      renderItem={({ item }) => (
        <DialogueLineCard line={item} character={character} />
      )}
      scrollEnabled={false}
    />
  );
}

export default function DialogueScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novelId = Number(id);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);

  const { data: characters, isLoading, error } = useListCharacters(novelId);

  const mainChars = useMemo(
    () =>
      (characters ?? []).filter(
        (c) => c.role === "protagonist" || c.role === "antagonist" || c.role === "supporting"
      ),
    [characters]
  );

  const selectedChar = useMemo(
    () => mainChars.find((c) => c.id === selectedCharId) ?? mainChars[0],
    [mainChars, selectedCharId]
  );

  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !characters || mainChars.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="message-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No dialogue found</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Dialogue lines appear after analysis
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={[styles.filterScroll, { borderBottomColor: colors.border }]}
      >
        {mainChars.map((c) => {
          const isSelected = (selectedChar?.id ?? -1) === c.id;
          const roleColor = ROLE_COLORS[c.role] ?? colors.primary;
          return (
            <Pressable
              key={c.id}
              onPress={() => setSelectedCharId(c.id)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? roleColor + "25" : colors.card,
                  borderColor: isSelected ? roleColor : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: isSelected ? roleColor : colors.mutedForeground },
                ]}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 16 }]}>
        {selectedChar ? (
          <CharacterDialogue character={selectedChar} novelId={novelId} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  filterScroll: { maxHeight: 56, borderBottomWidth: 1 },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { padding: 16, gap: 10 },
  lineCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  lineHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lineName: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  lineChapter: { fontSize: 11, fontFamily: "Inter_400Regular" },
  lineText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    fontStyle: "italic",
  },
  lineContext: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

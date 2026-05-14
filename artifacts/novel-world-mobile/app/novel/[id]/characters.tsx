import { useListCharacters } from "@workspace/api-client-react";
import type { Character } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
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

function CharacterCard({ character, onPress }: { character: Character; onPress: () => void }) {
  const colors = useColors();
  const roleColor = ROLE_COLORS[character.role] ?? colors.mutedForeground;
  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {character.imageUrl ? (
        <Image
          source={{ uri: `${baseUrl}${character.imageUrl}` }}
          style={styles.portrait}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.portraitPlaceholder, { backgroundColor: roleColor + "20" }]}>
          <Text style={[styles.portraitInitial, { color: roleColor }]}>
            {character.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
        {character.name}
      </Text>
      <View style={[styles.roleBadge, { backgroundColor: roleColor + "25" }]}>
        <Text style={[styles.roleText, { color: roleColor }]}>
          {character.role}
        </Text>
      </View>
      {character.dialogueCount ? (
        <Text style={[styles.dialogueCount, { color: colors.mutedForeground }]}>
          {character.dialogueCount} lines
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function CharactersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novelId = Number(id);

  const { data: characters, isLoading, error, refetch } = useListCharacters(novelId);

  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !characters) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Failed to load characters</Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.border }]}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (characters.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="users" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No characters found</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Run analysis to discover characters
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={characters}
        keyExtractor={(c) => String(c.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <CharacterCard
            character={item}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/novel/${novelId}/character/${item.id}`);
            }}
          />
        )}
        contentContainerStyle={[styles.grid, { paddingBottom: bottomInset + 16 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  grid: { padding: 12, gap: 12 },
  row: { gap: 12 },
  card: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  portrait: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  portraitPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitInitial: { fontSize: 28, fontFamily: "Inter_700Bold" },
  name: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dialogueCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginTop: 8 },
  retryText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});

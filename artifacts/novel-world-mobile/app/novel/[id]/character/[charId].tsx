import {
  useGetCharacter,
  useListCharacterLines,
  useGenerateCharacterImage,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const ROLE_COLORS: Record<string, string> = {
  protagonist: "#C8A428",
  antagonist: "#e63946",
  supporting: "#52b788",
  minor: "#90caf9",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.primary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function CharacterDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { id, charId } = useLocalSearchParams<{ id: string; charId: string }>();
  const characterId = Number(charId);
  const novelId = Number(id);
  const queryClient = useQueryClient();

  const { data: character, isLoading } = useGetCharacter(characterId);
  const { data: lines } = useListCharacterLines(characterId, {
    query: { enabled: !!character },
  });
  const generateMutation = useGenerateCharacterImage();

  useEffect(() => {
    if (character?.name) {
      navigation.setOptions({ title: character.name });
    }
  }, [character?.name, navigation]);

  const handleGenerateImage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    generateMutation.mutate(
      { characterId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}`] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => Alert.alert("Error", "Failed to generate image."),
      }
    );
  };

  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  const roleColor = character ? ROLE_COLORS[character.role] ?? colors.mutedForeground : colors.mutedForeground;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!character) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>Character not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: bottomInset + 24 }]}
    >
      <View style={styles.heroRow}>
        {character.imageUrl ? (
          <Image
            source={{ uri: `${baseUrl}${character.imageUrl}` }}
            style={styles.portrait}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.portraitPlaceholder, { backgroundColor: roleColor + "20" }]}>
            <Text style={[styles.portraitInitial, { color: roleColor }]}>
              {character.name.charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.heroInfo}>
          <Text style={[styles.name, { color: colors.foreground }]}>{character.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + "25" }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{character.role}</Text>
          </View>
          {character.dialogueCount ? (
            <Text style={[styles.dialogueMeta, { color: colors.mutedForeground }]}>
              {character.dialogueCount} dialogue lines
            </Text>
          ) : null}
          <Pressable
            onPress={handleGenerateImage}
            disabled={generateMutation.isPending}
            style={({ pressed }) => [
              styles.genBtn,
              { backgroundColor: colors.primary, opacity: pressed || generateMutation.isPending ? 0.7 : 1 },
            ]}
          >
            {generateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="image" size={14} color={colors.primaryForeground} />
            )}
            <Text style={[styles.genBtnText, { color: colors.primaryForeground }]}>
              {character.imageUrl ? "Regenerate" : "Generate Portrait"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <InfoRow label="Description" value={character.description} />
        <InfoRow label="Personality" value={character.personality} />
        <InfoRow label="Appearance" value={character.physicalDescription} />
        <InfoRow label="Relationships" value={character.relationships} />
      </View>

      {(lines?.length ?? 0) > 0 && (
        <View style={styles.dialogueSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Dialogue Highlights
          </Text>
          {lines!.slice(0, 5).map((line) => (
            <View
              key={line.id}
              style={[styles.dialogueLine, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.dialogueChapter, { color: colors.mutedForeground }]}>
                Chapter {line.chapterNumber}
              </Text>
              <Text style={[styles.dialogueText, { color: colors.foreground }]}>
                "{line.text}"
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  heroRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  portrait: { width: 100, height: 130, borderRadius: 8 },
  portraitPlaceholder: {
    width: 100,
    height: 130,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitInitial: { fontSize: 40, fontFamily: "Inter_700Bold" },
  heroInfo: { flex: 1, gap: 8 },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 26 },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  dialogueMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  genBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  genBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  section: { gap: 16, borderTopWidth: 1, paddingTop: 16 },
  infoRow: { gap: 4 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  infoValue: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  dialogueSection: { gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  dialogueLine: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  dialogueChapter: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dialogueText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, fontStyle: "italic" },
});

import { useListEvents, useGenerateEventImage } from "@workspace/api-client-react";
import type { StoryEvent } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const TONE_COLORS: Record<string, string> = {
  dramatic: "#e76f51",
  tense: "#e63946",
  romantic: "#f4a261",
  tragic: "#6d6875",
  hopeful: "#52b788",
  mysterious: "#90caf9",
  comedic: "#ffd166",
};

function EventCard({ event }: { event: StoryEvent }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const generateMutation = useGenerateEventImage();
  const [expanded, setExpanded] = useState(false);
  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  const toneColor = event.emotionalTone
    ? TONE_COLORS[event.emotionalTone.toLowerCase()] ?? colors.mutedForeground
    : colors.mutedForeground;

  const handleGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    generateMutation.mutate(
      { eventId: event.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/novels/${event.novelId}/events`] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => Alert.alert("Error", "Failed to generate scene image."),
      }
    );
  };

  return (
    <Pressable
      onPress={() => { setExpanded(!expanded); Haptics.selectionAsync(); }}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.chapterBadge, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.chapterText, { color: colors.primary }]}>Ch. {event.chapterNumber}</Text>
        </View>
        {event.emotionalTone ? (
          <View style={[styles.toneBadge, { backgroundColor: toneColor + "25" }]}>
            <Text style={[styles.toneText, { color: toneColor }]}>{event.emotionalTone}</Text>
          </View>
        ) : null}
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </View>

      <Text style={[styles.eventTitle, { color: colors.foreground }]}>{event.title}</Text>

      {event.location ? (
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{event.location}</Text>
        </View>
      ) : null}

      {expanded ? (
        <>
          {event.imageUrl ? (
            <Image
              source={{ uri: `${baseUrl}${event.imageUrl}` }}
              style={styles.eventImage}
              contentFit="cover"
            />
          ) : null}
          {event.description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {event.description}
            </Text>
          ) : null}
          {event.characters?.length > 0 ? (
            <View style={styles.charRow}>
              <Feather name="users" size={12} color={colors.mutedForeground} />
              <Text style={[styles.charText, { color: colors.mutedForeground }]}>
                {event.characters.join(", ")}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={handleGenerate}
            disabled={generateMutation.isPending}
            style={({ pressed }) => [
              styles.genBtn,
              { borderColor: colors.border, opacity: pressed || generateMutation.isPending ? 0.7 : 1 },
            ]}
          >
            {generateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="image" size={14} color={colors.primary} />
            )}
            <Text style={[styles.genBtnText, { color: colors.primary }]}>
              {event.imageUrl ? "Regenerate Scene" : "Generate Scene"}
            </Text>
          </Pressable>
        </>
      ) : null}
    </Pressable>
  );
}

export default function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novelId = Number(id);

  const { data: events, isLoading, error, refetch } = useListEvents(novelId);

  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !events) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Failed to load events</Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.border }]}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="zap" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No events found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={events}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <EventCard event={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 16 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  chapterBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  chapterText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  toneBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  toneText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  eventTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 21 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  eventImage: { width: "100%", height: 160, borderRadius: 8, marginTop: 4 },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  charRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  charText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  genBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  genBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginTop: 8 },
  retryText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});

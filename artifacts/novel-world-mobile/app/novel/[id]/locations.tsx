import { useListLocations, useGenerateLocationImage } from "@workspace/api-client-react";
import type { Location } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React from "react";
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

const CATEGORY_ICONS: Record<string, string> = {
  city: "home",
  forest: "wind",
  castle: "shield",
  sea: "anchor",
  dungeon: "lock",
  village: "users",
  ruins: "x-square",
  palace: "star",
};

function LocationCard({ location }: { location: Location }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const generateMutation = useGenerateLocationImage();
  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  const iconName = location.category
    ? (CATEGORY_ICONS[location.category.toLowerCase()] ?? "map-pin")
    : "map-pin";

  const handleGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    generateMutation.mutate(
      { locationId: location.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/novels/${location.novelId}/locations`],
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => Alert.alert("Error", "Failed to generate image."),
      }
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {location.imageUrl ? (
        <Image
          source={{ uri: `${baseUrl}${location.imageUrl}` }}
          style={styles.locationImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.locationImagePlaceholder, { backgroundColor: colors.muted }]}>
          <Feather name={iconName as any} size={28} color={colors.primary} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={[styles.locationName, { color: colors.foreground }]}>
            {location.name}
          </Text>
          {location.category ? (
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.categoryText, { color: colors.primary }]}>
                {location.category}
              </Text>
            </View>
          ) : null}
        </View>
        {location.atmosphere ? (
          <Text style={[styles.atmosphere, { color: colors.mutedForeground }]}>
            {location.atmosphere}
          </Text>
        ) : null}
        {location.description ? (
          <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={3}>
            {location.description}
          </Text>
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
            <Feather name="image" size={13} color={colors.primary} />
          )}
          <Text style={[styles.genBtnText, { color: colors.primary }]}>
            {location.imageUrl ? "Regenerate" : "Generate Image"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function LocationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novelId = Number(id);

  const { data: locations, isLoading, error, refetch } = useListLocations(novelId);

  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !locations) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={36} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Failed to load locations</Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.border }]}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (locations.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="map-pin" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No locations found</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Locations appear after analysis
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={locations}
        keyExtractor={(l) => String(l.id)}
        renderItem={({ item }) => <LocationCard location={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 16 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  locationImage: { width: "100%", height: 140 },
  locationImagePlaceholder: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 14, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  locationName: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  categoryText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  atmosphere: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  genBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  genBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
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

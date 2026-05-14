import {
  useGetNovel,
  useAnalyzeNovel,
  useGetNovelSummary,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
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

const SECTION_ITEMS = [
  { key: "characters", label: "Characters", icon: "users" as const, color: "#C8A428" },
  { key: "events", label: "Events", icon: "zap" as const, color: "#e76f51" },
  { key: "dialogue", label: "Dialogue", icon: "message-circle" as const, color: "#52b788" },
  { key: "locations", label: "Locations", icon: "map-pin" as const, color: "#90caf9" },
] as const;

function StatBadge({ label, value }: { label: string; value?: number | null }) {
  const colors = useColors();
  if (value == null) return null;
  return (
    <View style={[styles.statBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.primary }]}>
        {value.toLocaleString()}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function NovelDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novelId = Number(id);
  const queryClient = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: novel, isLoading } = useGetNovel(novelId);
  const { data: summary } = useGetNovelSummary(novelId, {
    query: { enabled: novel?.status === "ready" },
  });
  const analyzeMutation = useAnalyzeNovel();

  useEffect(() => {
    if (novel?.title) {
      navigation.setOptions({ title: novel.title });
    }
  }, [novel?.title, navigation]);

  useEffect(() => {
    if (novel?.status === "analyzing") {
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/novels/${novelId}`] });
      }, 3000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [novel?.status, novelId, queryClient]);

  const handleAnalyze = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analyzeMutation.mutate(
      { novelId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/novels/${novelId}`] });
        },
        onError: () => {
          Alert.alert("Error", "Failed to start analysis.");
        },
      }
    );
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!novel) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Novel not found</Text>
      </View>
    );
  }

  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: bottomInset + 24 },
      ]}
    >
      {novel.coverImageUrl ? (
        <Image
          source={{ uri: `${baseUrl}${novel.coverImageUrl}` }}
          style={styles.cover}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: colors.card }]}>
          <Feather name="book-open" size={48} color={colors.primary} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>{novel.title}</Text>

        {novel.synopsis ? (
          <Text style={[styles.synopsis, { color: colors.mutedForeground }]}>
            {novel.synopsis}
          </Text>
        ) : null}

        <View style={styles.stats}>
          <StatBadge label="pages" value={novel.pageCount} />
          <StatBadge label="words" value={novel.wordCount} />
          <StatBadge label="characters" value={novel.characterCount} />
          <StatBadge label="events" value={novel.eventCount} />
        </View>

        {novel.status === "ready" ? (
          <View style={styles.sections}>
            {SECTION_ITEMS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/novel/${novelId}/${item.key}`);
                }}
                style={({ pressed }) => [
                  styles.sectionCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={[styles.sectionIcon, { backgroundColor: item.color + "20" }]}>
                  <Feather name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        ) : novel.status === "analyzing" ? (
          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: "#744210" + "60" }]}>
            <ActivityIndicator size="small" color="#e9c46a" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusCardTitle, { color: "#e9c46a" }]}>
                Analyzing your novel…
              </Text>
              <Text style={[styles.statusCardSub, { color: colors.mutedForeground }]}>
                This may take a few minutes
              </Text>
            </View>
          </View>
        ) : novel.status === "uploaded" || novel.status === "error" ? (
          <Pressable
            onPress={handleAnalyze}
            disabled={analyzeMutation.isPending}
            style={({ pressed }) => [
              styles.analyzeBtn,
              { backgroundColor: colors.primary, opacity: pressed || analyzeMutation.isPending ? 0.7 : 1 },
            ]}
          >
            {analyzeMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="cpu" size={18} color={colors.primaryForeground} />
            )}
            <Text style={[styles.analyzeBtnText, { color: colors.primaryForeground }]}>
              {novel.status === "error" ? "Retry Analysis" : "Start Analysis"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  cover: { width: "100%", height: 220 },
  coverPlaceholder: {
    width: "100%",
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 30 },
  synopsis: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 70,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sections: { gap: 10, marginTop: 4 },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 14,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium" },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    marginTop: 4,
  },
  statusCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusCardSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  analyzeBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});

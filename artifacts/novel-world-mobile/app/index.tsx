import { useListNovels } from "@workspace/api-client-react";
import type { Novel } from "@workspace/api-client-react";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const STATUS_COLORS: Record<string, string> = {
  ready: "#2d6a4f",
  analyzing: "#744210",
  uploaded: "#1a3a6a",
  error: "#7e1e1e",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  analyzing: "Analyzing…",
  uploaded: "Queued",
  error: "Error",
};

function NovelCard({ novel, onPress }: { novel: Novel; onPress: () => void }) {
  const colors = useColors();
  const statusColor = STATUS_COLORS[novel.status] ?? colors.muted;
  const statusLabel = STATUS_LABELS[novel.status] ?? novel.status;

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
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {novel.title}
        </Text>
        <View style={styles.cardMeta}>
          {novel.wordCount ? (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {(novel.wordCount / 1000).toFixed(0)}k words
            </Text>
          ) : null}
          {novel.characterCount ? (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {novel.characterCount} chars
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "40" }]}>
          <Text style={[styles.statusText, { color: statusColor === STATUS_COLORS.ready ? "#52b788" : statusColor === STATUS_COLORS.analyzing ? "#e9c46a" : "#90caf9" }]}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: novels, isLoading, refetch, isRefetching, error } = useListNovels();

  const handleUpload = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Upload", "Use the web app to upload novels.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setUploading(true);
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: "application/pdf",
      } as unknown as Blob);
      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${baseUrl}/api/novels/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/novels"] });
      Alert.alert("Uploaded", "Your novel has been queued for analysis.");
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to upload novel. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [queryClient]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Novel World</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {novels?.length ?? 0} {novels?.length === 1 ? "novel" : "novels"} in library
          </Text>
        </View>
        <Pressable
          onPress={handleUpload}
          disabled={uploading}
          style={({ pressed }) => [
            styles.uploadBtn,
            { backgroundColor: colors.primary, opacity: pressed || uploading ? 0.7 : 1 },
          ]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="upload" size={18} color={colors.primaryForeground} />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Connection error</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Make sure the API server is running
          </Text>
          <Pressable onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.border }]}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (novels?.length ?? 0) === 0 ? (
        <View style={styles.center}>
          <Feather name="book-open" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your library is empty</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Upload a PDF to begin literary analysis
          </Text>
          <Pressable
            onPress={handleUpload}
            disabled={uploading}
            style={({ pressed }) => [
              styles.uploadBtnLarge,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="upload" size={16} color={colors.primaryForeground} />
            <Text style={[styles.uploadBtnText, { color: colors.primaryForeground }]}>
              Upload PDF
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={novels}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NovelCard
              novel={item}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/novel/${item.id}`);
              }}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#C8A428",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  uploadBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  uploadBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cardMeta: {
    flexDirection: "row",
    gap: 12,
  },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});

import { router } from "expo-router";
import {
  ArrowUpRight,
  Bell,
  ClipboardList,
  FileDown,
  Hand,
  HandHeart,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  Newspaper,
  Shield,
  ShoppingBag,
  Store,
  Sparkles,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { ScreenHeader } from "@/components/layout/screen-header";
import { useShowSurfaceSwitch } from "@/components/layout/surface-switch";
import {
  AppText,
  Button,
  Card,
  Carousel,
  EmptyState,
  IconButton,
  InlineBanner,
  PressableCard,
  Screen,
  SectionHeader,
  SkeletonBanner,
  SkeletonListRow,
  SkeletonStatCard,
  StatCard,
  useDelayedLoading,
} from "@/components/ui";
import {
  HOME_SECTION_DEFAULTS,
  visibleHomeSections,
  type HomeSection,
} from "@/domain/home-config";
import {
  greetingKey,
  pick,
  STAT_KEYS,
  type Language,
  type MarketingCard,
  type PlatformStats,
  type StatKey,
} from "@/domain/marketing";
import { BannerCard } from "@/features/home/banner-card";
import { NewsRow } from "@/features/home/news-row";
import { useTranslation } from "@/localization";
import { useAuth } from "@/providers/auth-provider";
import { useWorkspace } from "@/providers/workspace-provider";
import {
  useBanners,
  useHomeConfig,
  useMarketingCards,
  useNewsPreview,
  usePlatformStats,
} from "@/services/marketing/use-marketing";
import {
  usePopularItems,
  usePopularSuppliers,
  useTopBags,
} from "@/services/store/use-store";
import { formatPriceMinor, localizedName } from "@/domain/store";
import { supplierRating } from "@/domain/supplier-profile";
import { surfaceTarget } from "@/services/navigation/surface-memory";
import {
  iconStroke,
  radii,
  screenPadding,
  sizes,
  spacing,
  useTheme,
} from "@/theme";
import { enter } from "@/theme/motion";
import { formatNumber } from "@/utils/format";

const CARD_ICONS: Record<MarketingCard["icon"], LucideIcon> = {
  heart: Heart,
  users: Users,
  shield: Shield,
  "wifi-off": WifiOff,
  "file-down": FileDown,
  sparkles: Sparkles,
  hand: Hand,
};
const STAT_ICONS: Record<StatKey, LucideIcon> = {
  usersCount: Hand,
  workspacesCount: LayoutGrid,
  membersCount: Users,
  sessionsCount: ClipboardList,
};

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === "en" ? "en" : "ar";
  const { profile, user } = useAuth();
  const { workspaceId, workspace, member } = useWorkspace();
  const banners = useBanners();
  const cards = useMarketingCards();
  const stats = usePlatformStats();
  const home = useHomeConfig();
  const layout = home.data ?? HOME_SECTION_DEFAULTS;
  const newsCount = layout.find((section) => section.key === "news")?.count ?? 3;
  const news = useNewsPreview(newsCount);
  const [hour] = useState(() => new Date().getHours());
  const [collapsed, setCollapsed] = useState(false);
  const name = (profile?.displayName || user?.displayName || "").split(" ")[0];
  const hasWorkspace = !!workspaceId && !!member;
  const greeting = t(`marketingHome.${greetingKey(hour)}`);
  const sections = visibleHomeSections(layout);

  const refresh = useCallback(() => {
    banners.retry();
    cards.retry();
    stats.retry();
    home.retry();
    news.refresh();
  }, [banners, cards, stats, home, news]);

  return (
    <Screen
      refreshing={news.refreshing}
      onRefresh={refresh}
      onCollapsedChange={setCollapsed}
      header={
        <ScreenHeader
          variant="compact"
          collapsed={collapsed}
          title={
            name
              ? t("marketingHome.greetingNamed", { greeting, name })
              : greeting
          }
          actions={
            <IconButton
              icon={Bell}
              label={t("marketingHome.notifications")}
              onPress={() => router.push("/news")}
            />
          }
        />
      }
      contentStyle={styles.content}
    >
      {home.status === "error" ? (
        <InlineBanner
          tone="danger"
          message={t("marketingHome.configFailed")}
          actionLabel={t("common.retry")}
          onAction={home.retry}
        />
      ) : null}
      {sections.map((section) => (
        <HomeBlock
          key={section.key}
          section={section}
          language={language}
          banners={banners}
          stats={stats}
          cards={cards.data}
          news={news}
          hasWorkspace={hasWorkspace}
          workspaceName={workspace?.name ?? ""}
        />
      ))}
    </Screen>
  );
}

function HomeBlock({
  section,
  language,
  banners,
  stats,
  cards,
  news,
  hasWorkspace,
  workspaceName,
}: {
  section: HomeSection;
  language: Language;
  banners: ReturnType<typeof useBanners>;
  stats: ReturnType<typeof usePlatformStats>;
  cards: MarketingCard[] | null;
  news: ReturnType<typeof useNewsPreview>;
  hasWorkspace: boolean;
  workspaceName: string;
}) {
  const { t } = useTranslation();
  const title = t(`marketingHome.sections.${section.key}`);
  switch (section.key) {
    case "banners":
      return <BannersSection state={banners} language={language} count={section.count} />;
    case "stats":
      return (
        <StatsSection
          stats={stats}
          cards={cards}
          language={language}
          count={section.count}
        />
      );
    case "quickLinks":
      return (
        <QuickLinks
          count={section.count}
          hasWorkspace={hasWorkspace}
          workspaceName={workspaceName}
        />
      );
    case "news":
      return (
        <View>
          <SectionHeader
            title={title}
            actionLabel={news.items.length ? t("marketingHome.seeAll") : undefined}
            onAction={() => router.push("/news")}
          />
          <NewsPreview news={news} language={language} />
        </View>
      );
    case "featuredItems":
    case "popularSuppliers":
    case "topBags":
      return <StoreSection sectionKey={section.key} title={title} language={language} count={section.count} />;
    default:
      return <LaterSection title={title} />;
  }
}

function LaterSection({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <View>
      <SectionHeader title={title} />
      <EmptyState
        icon={Sparkles}
        title={t("marketingHome.sectionLater")}
        hint={t("marketingHome.sectionLaterHint")}
      />
    </View>
  );
}

function StoreSection({
  sectionKey,
  title,
  language,
  count,
}: {
  sectionKey: "featuredItems" | "popularSuppliers" | "topBags";
  title: string;
  language: Language;
  count: number;
}) {
  const { t } = useTranslation();
  const locale = language;

  const popularItems = usePopularItems(sectionKey === "featuredItems" ? count : 0);
  const popularSuppliers = usePopularSuppliers(sectionKey === "popularSuppliers" ? count : 0);
  const topBags = useTopBags(sectionKey === "topBags" ? count : 0);

  if (sectionKey === "featuredItems") {
    const items = popularItems.items ?? [];
    if (popularItems.status !== "ready" && popularItems.status !== "loading") return null;
    if (!items.length && popularItems.status !== "loading") return null;
    return (
      <View>
        <SectionHeader
          title={title}
          actionLabel={items.length ? t("marketingHome.seeAll") : undefined}
          onAction={() => router.push("/store")}
        />
        <View style={storeStyles.row}>
          {items.slice(0, count).map((item) => (
            <Pressable
              key={item.id}
              style={storeStyles.itemChip}
              onPress={() => router.push({ pathname: "/store/item/[id]", params: { id: item.id } })}
            >
              <AppText variant="bodySm" weight="semibold" numberOfLines={1}>
                {localizedName(item.name, locale)}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {formatPriceMinor(item.priceMinor, item.currency, locale)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (sectionKey === "popularSuppliers") {
    const suppliers = popularSuppliers.items ?? [];
    if (!suppliers.length && popularSuppliers.status !== "loading") return null;
    return (
      <View>
        <SectionHeader
          title={title}
          actionLabel={suppliers.length ? t("marketingHome.seeAll") : undefined}
          onAction={() => router.push("/store")}
        />
        <View style={storeStyles.supplierList}>
          {suppliers.slice(0, count).map((s) => {
            const r = supplierRating(s);
            return (
              <Pressable
                key={s.id}
                style={storeStyles.supplierChip}
                onPress={() => router.push({ pathname: "/store/supplier/[id]", params: { id: s.id } })}
              >
                <AppText variant="body" weight="semibold" numberOfLines={1}>{s.name}</AppText>
                {r != null ? (
                  <AppText variant="caption" tone="secondary">{r} ★</AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // topBags
  const bags = topBags.items ?? [];
  if (!bags.length && topBags.status !== "loading") return null;
  return (
    <View>
      <SectionHeader
        title={title}
        actionLabel={bags.length ? t("marketingHome.seeAll") : undefined}
        onAction={() => router.push("/bags")}
      />
      <View style={storeStyles.supplierList}>
        {bags.slice(0, count).map((b) => (
          <Pressable
            key={b.id}
            style={storeStyles.supplierChip}
            onPress={() => router.push({ pathname: "/bags/[id]", params: { id: b.id } })}
          >
            <View style={storeStyles.bagRow}>
              <ShoppingBag size={16} />
              <AppText variant="body" weight="semibold" numberOfLines={1} style={storeStyles.flex}>
                {b.name}
              </AppText>
            </View>
            <AppText variant="caption" tone="secondary">
              {formatPriceMinor(b.totalMinor, b.currency, locale)}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BannersSection({
  state,
  language,
  count,
}: {
  state: ReturnType<typeof useBanners>;
  language: Language;
  count: number;
}) {
  const { t } = useTranslation();
  const showSkeleton = useDelayedLoading(state.status === "loading");
  if (state.status === "error") {
    return (
      <InlineBanner
        tone="danger"
        message={t("marketingHome.bannerLoadFailed")}
        actionLabel={t("common.retry")}
        onAction={state.retry}
      />
    );
  }
  if (state.status === "loading")
    return showSkeleton ? <SkeletonBanner /> : null;
  const data = state.data?.slice(0, count) ?? [];
  if (!data.length) return null;
  return (
    <Carousel
      data={data}
      keyExtractor={(b) => b.id}
      accessibilityLabel={t("marketingHome.bannersLabel")}
      renderItem={(banner, _index, width) => (
        <BannerCard banner={banner} language={language} width={width} />
      )}
    />
  );
}

function StatsSection({
  stats,
  cards,
  language,
  count,
}: {
  stats: ReturnType<typeof usePlatformStats>;
  cards: MarketingCard[] | null;
  language: Language;
  count: number;
}) {
  const { t } = useTranslation();
  const showSkeleton = useDelayedLoading(stats.status === "loading");
  const { width } = useWindowDimensions();
  const tile =
    (Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3]) / 2;

  if (stats.status === "loading") {
    if (!showSkeleton) return null;
    return (
      <View style={styles.grid}>
        {STAT_KEYS.map((k) => (
          <View key={k} style={{ width: tile }}>
            <SkeletonStatCard />
          </View>
        ))}
      </View>
    );
  }
  // Numbers are curated by the team; an unset doc or an error hides the section rather than showing zeros.
  const data: PlatformStats | null =
    stats.status === "ready" && stats.data?.exists ? stats.data : null;
  const statCards = (cards ?? []).filter(
    (c) =>
      c.type === "stat" &&
      c.statKey &&
      (STAT_KEYS as readonly string[]).includes(c.statKey),
  );
  const tips = (cards ?? []).filter((c) => c.type !== "stat");
  const tiles: {
    key: string;
    value: number;
    label: string;
    icon: LucideIcon;
  }[] = data
    ? statCards.length
      ? statCards.map((c) => ({
          key: c.id,
          value: data[c.statKey as StatKey],
          label: pick(c.title, language),
          icon: CARD_ICONS[c.icon],
        }))
      : STAT_KEYS.map((k) => ({
          key: k,
          value: data[k],
          label: t(`marketingHome.stat.${k}`),
          icon: STAT_ICONS[k],
        }))
    : [];
  const visible = tiles.filter((s) => s.value > 0).slice(0, count);

  return (
    <>
      {visible.length ? (
        <View>
          <SectionHeader title={t("marketingHome.statsTitle")} />
          <View style={styles.grid}>
            {visible.map((s, i) => (
              <View key={s.key} style={{ width: tile }}>
                <StatCard
                  value={formatNumber(s.value)}
                  label={s.label}
                  icon={s.icon}
                  tone={i === 0 ? "lime" : "surface"}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {tips.length ? (
        <View>
          <SectionHeader title={t("marketingHome.insightsTitle")} />
          <View style={styles.tips}>
            {tips.map((c) => (
              <TipCard key={c.id} card={c} language={language} />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

function TipCard({
  card,
  language,
}: {
  card: MarketingCard;
  language: Language;
}) {
  const { colors } = useTheme();
  const Icon = CARD_ICONS[card.icon];
  const subtitle = pick(card.subtitle, language);
  return (
    <Card style={styles.tip}>
      <View style={[styles.tile, { backgroundColor: colors.accent }]}>
        <Icon
          color={colors.onAccent}
          size={sizes.icon}
          strokeWidth={iconStroke}
        />
      </View>
      <View style={styles.flex}>
        <AppText variant="body" weight="semibold">
          {pick(card.title, language)}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

function QuickLinks({
  count,
  hasWorkspace,
  workspaceName,
}: {
  count: number;
  hasWorkspace: boolean;
  workspaceName: string;
}) {
  const { t } = useTranslation();
  const showDashboard = useShowSurfaceSwitch();
  const { width } = useWindowDimensions();
  const tile =
    (Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3]) / 2;
  const actions: {
    icon: LucideIcon;
    label: string;
    href: "/activities" | "/sessions" | "/news" | "/support" | "/store" | "/dashboard";
    show: boolean;
    pinned?: boolean;
  }[] = [
    {
      icon: LayoutDashboard,
      label: t("dashboard.switchToDashboard"),
      href: "/dashboard",
      show: showDashboard,
      pinned: true,
    },
    {
      icon: LayoutGrid,
      label: t("marketingHome.activities"),
      href: "/activities",
      show: hasWorkspace,
    },
    {
      icon: ClipboardList,
      label: t("marketingHome.sessions"),
      href: "/sessions",
      show: hasWorkspace,
    },
    {
      icon: Store,
      label: t("marketingHome.store"),
      href: "/store",
      show: true,
    },
    { icon: Newspaper, label: t("marketingHome.newsAction"), href: "/news", show: true },
    { icon: HandHeart, label: t("marketingHome.support"), href: "/support", show: true },
  ];
  const visible = [
    ...actions.filter((action) => action.show && action.pinned),
    ...actions.filter((action) => action.show && !action.pinned).slice(0, count),
  ];
  return (
    <View>
      <SectionHeader title={t("marketingHome.quickTitle")} />
      <Card tone="ink" style={styles.cta}>
        <AppText variant="h3" tone="onPrimary">
          {hasWorkspace
            ? t("marketingHome.ctaOpenTitle", { name: workspaceName })
            : t("marketingHome.ctaCreateTitle")}
        </AppText>
        <AppText variant="bodySm" tone="onPrimary" style={styles.ctaBody}>
          {hasWorkspace
            ? t("marketingHome.ctaOpenBody")
            : t("marketingHome.ctaCreateBody")}
        </AppText>
        <Button
          title={
            hasWorkspace
              ? t("marketingHome.ctaOpenAction")
              : t("marketingHome.ctaCreateAction")
          }
          variant="lime"
          icon={<ArrowUpRight />}
          onPress={() =>
            router.push(hasWorkspace ? "/activities" : "/onboarding/create")
          }
        />
      </Card>
      <View style={[styles.grid, styles.afterCard]}>
      {visible.map((a) => (
        <Animated.View
          key={a.href}
          entering={enter.rise()}
          style={{ width: tile }}
        >
          <QuickAction
            icon={a.icon}
            label={a.label}
            onPress={() =>
              a.href === "/dashboard"
                ? router.navigate(surfaceTarget("app") as "/dashboard")
                : router.push(a.href)
            }
          />
        </Animated.View>
      ))}
      </View>
    </View>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.quickItem}
    >
      <View style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
        <Icon
          color={colors.textPrimary}
          size={sizes.icon}
          strokeWidth={iconStroke}
        />
      </View>
      <AppText
        variant="body"
        weight="semibold"
        numberOfLines={2}
        style={styles.flex}
      >
        {label}
      </AppText>
    </PressableCard>
  );
}

function NewsPreview({
  news,
  language,
}: {
  news: ReturnType<typeof useNewsPreview>;
  language: Language;
}) {
  const { t } = useTranslation();
  const showSkeleton = useDelayedLoading(news.status === "loading");
  if (news.status === "loading") {
    return showSkeleton ? (
      <View style={styles.tips}>
        <SkeletonListRow />
        <SkeletonListRow />
      </View>
    ) : null;
  }
  if (news.status === "error") {
    return (
      <InlineBanner
        tone="danger"
        message={t("marketingHome.newsLoadFailed")}
        actionLabel={t("common.retry")}
        onAction={news.refresh}
      />
    );
  }
  if (!news.items.length) {
    return (
      <EmptyState
        icon={Newspaper}
        title={t("marketingHome.newsEmpty")}
        hint={t("marketingHome.newsEmptyHint")}
      />
    );
  }
  return (
    <View style={styles.tips}>
      {news.items.map((item, i) => (
        <Animated.View key={item.id} entering={enter.rise()}>
          <NewsRow item={item} language={language} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  flex: { flex: 1 },
  cta: { gap: spacing[2] },
  ctaBody: { marginBottom: spacing[2], opacity: 0.85 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  afterCard: { marginTop: spacing[3] },
  tips: { gap: spacing[3] },
  tip: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  tile: {
    width: sizes.iconTile,
    height: sizes.iconTile,
    borderRadius: radii.iconButton,
    alignItems: "center",
    justifyContent: "center",
  },
  quickItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    minHeight: 72,
  },
});

const storeStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3], paddingHorizontal: screenPadding },
  itemChip: { gap: spacing[1], paddingVertical: spacing[2], flex: 1, minWidth: 120 },
  supplierList: { gap: spacing[2], paddingHorizontal: screenPadding },
  supplierChip: { gap: spacing[1], paddingVertical: spacing[2] },
  bagRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  flex: { flex: 1 },
});

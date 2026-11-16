import { router } from 'expo-router';
import {
  ArrowUpRight,
  Bell,
  ClipboardList,
  FileDown,
  Hand,
  Heart,
  LayoutGrid,
  Newspaper,
  Shield,
  Sparkles,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Carousel,
  EmptyState,
  Header,
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
} from '@/components/ui';
import { greetingKey, pick, STAT_KEYS, type Language, type MarketingCard, type PlatformStats, type StatKey } from '@/domain/marketing';
import { BannerCard } from '@/features/home/banner-card';
import { NewsRow } from '@/features/home/news-row';
import { useTranslation } from '@/localization';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { useBanners, useMarketingCards, useNewsPreview, usePlatformStats } from '@/services/marketing/use-marketing';
import { iconStroke, radii, screenPadding, sizes, spacing, useTheme } from '@/theme';
import { formatNumber } from '@/utils/format';

const CARD_ICONS: Record<MarketingCard['icon'], LucideIcon> = {
  heart: Heart,
  users: Users,
  shield: Shield,
  'wifi-off': WifiOff,
  'file-down': FileDown,
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
  const language: Language = i18n.language === 'en' ? 'en' : 'ar';
  const { profile, user } = useAuth();
  const { workspaceId, workspace, member } = useWorkspace();
  const banners = useBanners();
  const cards = useMarketingCards();
  const stats = usePlatformStats();
  const news = useNewsPreview(3);
  const [hour] = useState(() => new Date().getHours());
  const name = (profile?.displayName || user?.displayName || '').split(' ')[0];
  const hasWorkspace = !!workspaceId && !!member;
  const greeting = t(`marketingHome.${greetingKey(hour)}`);

  const refresh = useCallback(() => {
    banners.retry();
    cards.retry();
    stats.retry();
    news.refresh();
  }, [banners, cards, stats, news]);

  return (
    <Screen
      refreshing={news.refreshing}
      onRefresh={refresh}
      header={
        <Header
          large
          title={name ? t('marketingHome.greetingNamed', { greeting, name }) : greeting}
          trailing={<IconButton icon={Bell} label={t('marketingHome.notifications')} onPress={() => router.push('/news')} />}
        />
      }
      contentStyle={styles.content}
    >
      <BannersSection state={banners} language={language} />

      <Card tone="ink" style={styles.cta}>
        <AppText variant="h3" tone="onPrimary">
          {hasWorkspace ? t('marketingHome.ctaOpenTitle', { name: workspace?.name ?? '' }) : t('marketingHome.ctaCreateTitle')}
        </AppText>
        <AppText variant="bodySm" tone="onPrimary" style={styles.ctaBody}>
          {hasWorkspace ? t('marketingHome.ctaOpenBody') : t('marketingHome.ctaCreateBody')}
        </AppText>
        <Button
          title={hasWorkspace ? t('marketingHome.ctaOpenAction') : t('marketingHome.ctaCreateAction')}
          variant="lime"
          icon={<ArrowUpRight />}
          onPress={() => router.push(hasWorkspace ? '/activities' : '/onboarding/create')}
        />
      </Card>

      <StatsSection stats={stats} cards={cards.data} language={language} />

      <View>
        <SectionHeader title={t('marketingHome.quickTitle')} />
        <View style={styles.quick}>
          <QuickAction icon={LayoutGrid} label={t('marketingHome.activities')} onPress={() => router.push('/activities')} />
          <QuickAction icon={ClipboardList} label={t('marketingHome.sessions')} onPress={() => router.push('/sessions')} />
          <QuickAction icon={Newspaper} label={t('marketingHome.newsAction')} onPress={() => router.push('/news')} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title={t('marketingHome.newsTitle')}
          actionLabel={news.items.length ? t('marketingHome.seeAll') : undefined}
          onAction={() => router.push('/news')}
        />
        <NewsPreview news={news} language={language} />
      </View>
    </Screen>
  );
}

function BannersSection({ state, language }: { state: ReturnType<typeof useBanners>; language: Language }) {
  const { t } = useTranslation();
  const showSkeleton = useDelayedLoading(state.status === 'loading');
  if (state.status === 'error') {
    return <InlineBanner tone="danger" message={t('marketingHome.bannerLoadFailed')} actionLabel={t('common.retry')} onAction={state.retry} />;
  }
  if (state.status === 'loading') return showSkeleton ? <SkeletonBanner /> : null;
  if (!state.data?.length) return null;
  return (
    <Carousel
      data={state.data}
      keyExtractor={(b) => b.id}
      accessibilityLabel={t('marketingHome.bannersLabel')}
      renderItem={(banner, _index, width) => <BannerCard banner={banner} language={language} width={width} />}
    />
  );
}

function StatsSection({
  stats,
  cards,
  language,
}: {
  stats: ReturnType<typeof usePlatformStats>;
  cards: MarketingCard[] | null;
  language: Language;
}) {
  const { t } = useTranslation();
  const showSkeleton = useDelayedLoading(stats.status === 'loading');
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, sizes.maxContent) - screenPadding * 2 - spacing[3]) / 2;

  if (stats.status === 'loading') {
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
  const data: PlatformStats | null = stats.status === 'ready' && stats.data?.exists ? stats.data : null;
  const statCards = (cards ?? []).filter((c) => c.type === 'stat' && c.statKey && (STAT_KEYS as readonly string[]).includes(c.statKey));
  const tips = (cards ?? []).filter((c) => c.type !== 'stat');
  const tiles: { key: string; value: number; label: string; icon: LucideIcon }[] = data
    ? statCards.length
      ? statCards.map((c) => ({
          key: c.id,
          value: data[c.statKey as StatKey],
          label: pick(c.title, language),
          icon: CARD_ICONS[c.icon],
        }))
      : STAT_KEYS.map((k) => ({ key: k, value: data[k], label: t(`marketingHome.stat.${k}`), icon: STAT_ICONS[k] }))
    : [];
  const visible = tiles.filter((s) => s.value > 0);

  return (
    <>
      {visible.length ? (
        <View>
          <SectionHeader title={t('marketingHome.statsTitle')} />
          <View style={styles.grid}>
            {visible.map((s, i) => (
              <View key={s.key} style={{ width: tile }}>
                <StatCard value={formatNumber(s.value)} label={s.label} icon={s.icon} tone={i === 0 ? 'lime' : 'surface'} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {tips.length ? (
        <View>
          <SectionHeader title={t('marketingHome.insightsTitle')} />
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

function TipCard({ card, language }: { card: MarketingCard; language: Language }) {
  const { colors } = useTheme();
  const Icon = CARD_ICONS[card.icon];
  const subtitle = pick(card.subtitle, language);
  return (
    <Card style={styles.tip}>
      <View style={[styles.tile, { backgroundColor: colors.accent }]}>
        <Icon color={colors.onAccent} size={sizes.icon} strokeWidth={iconStroke} />
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

function QuickAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableCard accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.quickItem}>
      <View style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
        <Icon color={colors.textPrimary} size={sizes.icon} strokeWidth={iconStroke} />
      </View>
      <AppText variant="label" center numberOfLines={1}>
        {label}
      </AppText>
    </PressableCard>
  );
}

function NewsPreview({ news, language }: { news: ReturnType<typeof useNewsPreview>; language: Language }) {
  const { t } = useTranslation();
  const showSkeleton = useDelayedLoading(news.status === 'loading');
  if (news.status === 'loading') {
    return showSkeleton ? (
      <View style={styles.tips}>
        <SkeletonListRow />
        <SkeletonListRow />
      </View>
    ) : null;
  }
  if (news.status === 'error') {
    return <InlineBanner tone="danger" message={t('marketingHome.newsLoadFailed')} actionLabel={t('common.retry')} onAction={news.refresh} />;
  }
  if (!news.items.length) {
    return <EmptyState icon={Newspaper} title={t('marketingHome.newsEmpty')} hint={t('marketingHome.newsEmptyHint')} />;
  }
  return (
    <View style={styles.tips}>
      {news.items.map((item) => (
        <NewsRow key={item.id} item={item} language={language} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6] },
  flex: { flex: 1 },
  section: { gap: spacing[1] },
  cta: { gap: spacing[2] },
  ctaBody: { marginBottom: spacing[2], opacity: 0.85 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  tips: { gap: spacing[3] },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  tile: { width: sizes.iconTile, height: sizes.iconTile, borderRadius: radii.iconButton, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', gap: spacing[3] },
  quickItem: { flex: 1, alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
});

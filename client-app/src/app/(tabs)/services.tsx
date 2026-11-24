import { router } from 'expo-router';
import { ChevronDown, ChevronUp, ChevronRight, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ServicePhoto } from '@/components/service/service-photo';
import { FilterChip } from '@/components/ui/filter-chip';
import { useServiceCategories } from '@/hooks/use-service-categories';
import { useServices } from '@/hooks/use-services';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { servicePriceLabel, type Service } from '@/config/services';
import { colors, font, radius, shadow, space, text } from '@/theme';

type CategoryFilter = 'all' | string;

/** Services shown per category before the customer expands the section. */
const COLLAPSED_COUNT = 2;

const priceLabel = (service: Service) => servicePriceLabel(service);

function ServiceCard({ service }: { service: Service }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${service.name}. ${priceLabel(service)}`}
      onPress={() =>
        router.push({
          pathname: '/service/[slug]',
          params: { slug: service.slug },
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardMedia}>
        <ServicePhoto
          slug={service.slug}
          cardUri={service.cardImage}
          style={styles.cardPhoto}
        />
        {service.tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{service.tag}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} maxFontSizeMultiplier={1.3} numberOfLines={2}>
          {service.name}
        </Text>
        <Text style={styles.tagline} maxFontSizeMultiplier={1.3} numberOfLines={2}>
          {service.tagline}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.price} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {priceLabel(service)}
          </Text>
          <ChevronRight size={16} color={colors.disabledText} strokeWidth={2} />
        </View>
      </View>
    </Pressable>
  );
}

/** P6 Services: category chips and grouped cards over `GET /services`. */
export default function ServicesTab() {
  const insets = useSafeAreaInsets();
  const { services, error, refresh } = useServices();
  const categories = useServiceCategories();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useStatusBarStyle('dark');

  const visible = services.filter(
    (service) => service.active !== false && (category === 'all' || service.categoryId === category),
  );
  const filters: readonly { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...[...categories]
      .sort((a, b) => a.order - b.order)
      .map((group) => ({ value: group.id, label: group.name })),
  ];
  const groups = [...categories]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      ...group,
      services: visible.filter((service) => service.categoryId === group.id),
    }))
    .filter((group) => group.services.length > 0);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space[4] }]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>
              Services
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search services"
              hitSlop={8}
              onPress={() => router.push('/search')}
              style={styles.searchButton}>
              <Search size={20} color={colors.green700} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
            Pick a service to see the price before you book.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}>
          {filters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              selected={filter.value === category}
              onPress={() => setCategory(filter.value)}
            />
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading services"
              hitSlop={8}
              onPress={refresh}>
              <Text style={styles.errorLink} maxFontSizeMultiplier={1.3}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}

        {groups.map((group) => {
          // Picking one category means the customer wants to browse it in full.
          const isExpanded = category !== 'all' || (expanded[group.id] ?? false);
          const overflow = group.services.length - COLLAPSED_COUNT;
          const canCollapse = category === 'all' && overflow > 0;
          const shown = isExpanded ? group.services : group.services.slice(0, COLLAPSED_COUNT);
          const toggle = () =>
            setExpanded((current) => ({ ...current, [group.id]: !isExpanded }));

          return (
            <View key={group.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>
                    {group.name}
                  </Text>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText} maxFontSizeMultiplier={1.2}>
                      {group.services.length}{' '}
                      {group.services.length === 1 ? 'service' : 'services'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sectionCaption} maxFontSizeMultiplier={1.2}>
                  {group.caption}
                </Text>
              </View>
              <View style={styles.grid}>
                {shown.map((service) => (
                  <ServiceCard key={service.slug} service={service} />
                ))}
              </View>
              {canCollapse ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isExpanded
                      ? `Show fewer ${group.name} services`
                      : `Show ${overflow} more ${group.name} services`
                  }
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={toggle}
                  style={({ pressed }) => [styles.expand, pressed && styles.expandPressed]}>
                  <Text style={styles.expandText} maxFontSizeMultiplier={1.2}>
                    {isExpanded ? 'Show less' : `Show ${overflow} more`}
                  </Text>
                  {isExpanded ? (
                    <ChevronUp size={16} color={colors.green700} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={16} color={colors.green700} strokeWidth={2} />
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {visible.length === 0 && !error ? (
          <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
            No services in this category yet.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space[4], paddingBottom: space[6], gap: space[5] },
  header: { gap: space[1] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...text.h1 },
  subtitle: { ...text.body, color: colors.textMuted },
  chipScroll: { flexGrow: 0, marginHorizontal: -space[4], marginTop: -space[2] },
  chipRow: { paddingHorizontal: space[4], alignItems: 'center', gap: space[2] },
  section: { gap: space[3] },
  sectionHeader: { gap: 2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  sectionTitle: { ...text.h3 },
  sectionCount: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  sectionCountText: { ...text.caption, fontFamily: font.bodySemi },
  sectionCaption: { ...text.caption },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space[3],
  },
  card: {
    width: '48.5%',
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardPressed: { opacity: 0.85 },
  cardMedia: { aspectRatio: 1.35, backgroundColor: colors.green100 },
  cardPhoto: { ...StyleSheet.absoluteFill },
  cardBody: { padding: space[3], gap: 2 },
  name: { ...text.bodyM, fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19 },
  tagline: { ...text.caption },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[1],
    marginTop: space[1],
  },
  price: { ...text.caption, color: colors.green700, fontFamily: font.bodySemi, flexShrink: 1 },
  tag: {
    position: 'absolute',
    top: space[2],
    left: space[2],
    height: 22,
    paddingHorizontal: space[2],
    borderRadius: 11,
    backgroundColor: colors.yellow500,
    justifyContent: 'center',
  },
  tagText: { fontFamily: font.bodySemi, fontSize: 11, lineHeight: 14, color: colors.green900 },
  expand: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: space[1],
    paddingVertical: space[1],
  },
  expandPressed: { opacity: 0.65 },
  expandText: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.green700, fontSize: 13 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    backgroundColor: colors.warningBg,
    borderRadius: radius.input,
    padding: space[3],
  },
  errorText: { ...text.caption, color: colors.text, flex: 1 },
  errorLink: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.green700, fontSize: 13 },
  emptyText: { ...text.body, color: colors.textMuted, textAlign: 'center' },
});

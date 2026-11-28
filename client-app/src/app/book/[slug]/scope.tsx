import { router, useLocalSearchParams } from 'expo-router';
import { Info, Plus, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { DynamicForm } from '@/components/booking/dynamic-form';
import { MediaPreview } from '@/components/booking/media-preview';
import { MediaSheet } from '@/components/booking/media-sheet';
import { MediaTile } from '@/components/booking/media-tile';
import { StepperHeader } from '@/components/booking/stepper-header';
import { SummaryBar } from '@/components/booking/summary-bar';
import { SummarySheet } from '@/components/booking/summary-sheet';
import { KeyboardScreen } from '@/components/ui/keyboard-screen';
import { TopBar } from '@/components/ui/top-bar';
import { jobMedia } from '@/config/media';
import { registerFormSchema } from '@/config/form-schemas';
import { loadFormDefinition } from '@/lib/api/forms';

import {
  isScopeComplete,
  schemaForScope,
  schemaForService,
  suggestJob,
  suggestionCopy,
} from '@/lib/booking-scope';
import {
  schemaLayout,
  validateAnswers,
  type FormField,
  type FormSchema,
  type FormValue,
} from '@/lib/form-schema';
import { deleteMediaFile } from '@/lib/media';
import { useService } from '@/hooks/use-service';
import { price, servicePricing, type BookingMediaItem } from '@/lib/pricing';
import { useDraftExit, useDraftGuard } from '@/lib/use-draft-exit';
import {
  getBookingDraft,
  patchDetails,
  patchScope,
  removeMedia,
  setMedia,
  startDraft,
  useBookingDraft,
} from '@/store/booking';
import { colors, font, radius, space, text } from '@/theme';
import { selectionHaptic } from '@/utils/haptics';

/** P8b Job scope, drawn from the service's schema (Workstream H, Sections 14.4 and 3.3). */
export default function JobScopeScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const draft = useBookingDraft();
  const service = useService(slug);
  const active = draft && draft.serviceSlug === slug ? draft : null;
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [sheetSlot, setSheetSlot] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<BookingMediaItem | null>(null);
  const [remoteSchema, setRemoteSchema] = useState<FormSchema | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const { requestExit, requestBack, sheet } = useDraftExit({ step: 'scope' });
  const ready = useDraftGuard(slug);

  useEffect(() => {
    if (!slug) return;
    const current = getBookingDraft();
    if (!current || current.serviceSlug !== slug) startDraft(slug, servicePricing(service));
  }, [slug, service]);

  // P1: prefer the current server definition (cached per service) and record its
  // id/version on the draft so the API can reject a stale submission.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void loadFormDefinition(slug).then((definition) => {
      if (cancelled || !definition) return;
      registerFormSchema(definition.schema);
      setRemoteSchema(definition.schema);
      const current = getBookingDraft();
      if (current?.serviceSlug === slug && current.scope) {
        patchScope({
          schemaId: definition.schema.id,
          schemaVersion: definition.version,
          formDefinitionId: definition.id,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const scope = active?.scope;
  const mediaItems = active?.media?.items ?? [];
  const schema = remoteSchema ?? (scope ? schemaForScope(scope) : schemaForService(slug));
  // Opt-in paged layout: one section at a time inside the Job scope stage. Schemas
  // without `layout` (and older builds) keep the single scrolling screen.
  const paged = schemaLayout(schema) === 'steps' && schema.sections.length > 1;
  const stepCount = schema.sections.length;
  const currentStep = Math.min(Math.max(stepIndex, 0), Math.max(stepCount - 1, 0));
  const activeSection = schema.sections[currentStep];
  const mediaSlots = useMemo(
    () =>
      schema.sections
        .flatMap((section) => section.fields)
        .filter((field) => field.type === 'media-slot'),
    [schema],
  );

  if (!ready || !active || !scope) return <View style={styles.screen} />;

  const { details } = active;
  const quote = price(active);
  const errors = validateAnswers(schema, scope.answers, mediaItems.length);
  // Errors for the section on screen, so Next only blocks on the current step.
  const stepErrors = paged && activeSection
    ? Object.fromEntries(
        Object.entries(errors).filter(([fieldId]) =>
          activeSection.fields.some((field) => field.id === fieldId),
        ),
      )
    : errors;
  // Slot-aware completeness: a required media slot needs a file in that slot.
  const missingSlot = mediaSlots.some(
    (field) => field.required && !mediaItems.some((item) => item.slotId === field.id),
  );
  const complete = isScopeComplete(scope, mediaItems) && !missingSlot;
  const suggestion = suggestJob(slug, scope);
  const showSuggestion =
    service?.pricingMode !== 'quote' &&
    suggestion !== undefined &&
    !suggestionDismissed &&
    (details.hours !== suggestion.hours || details.cleaners !== suggestion.cleaners);

  const onAnswer = (fieldId: string, value: FormValue) => {
    patchScope({ answers: { ...scope.answers, [fieldId]: value } });
  };

  const onNext = () => {
    if (paged && currentStep < stepCount - 1) {
      setShowErrors(true);
      const first = Object.values(stepErrors)[0];
      if (first) {
        Alert.alert('Finish this step', first);
        return;
      }
      setShowErrors(false);
      setStepIndex(currentStep + 1);
      return;
    }
    if (!complete) {
      setShowErrors(true);
      const first = Object.values(errors)[0];
      Alert.alert('Finish the required details', first ?? 'Add the required details to continue.');
      return;
    }
    router.push({ pathname: '/book/[slug]/schedule', params: { slug } });
  };

  const onPreviousStep = () => {
    setShowErrors(false);
    setStepIndex(Math.max(currentStep - 1, 0));
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    selectionHaptic();
    patchDetails({ hours: suggestion.hours, cleaners: suggestion.cleaners });
  };

  const onRemoveMedia = (id: string) => {
    const item = (getBookingDraft()?.media?.items ?? []).find((entry) => entry.id === id);
    if (item) deleteMediaFile(item.uri);
    removeMedia(id);
  };

  const sheetItems =
    sheetSlot === null
      ? mediaItems.filter((item) => !item.slotId)
      : mediaItems.filter((item) => item.slotId === sheetSlot);

  const onSheetChange = (next: BookingMediaItem[]) => {
    const others = mediaItems.filter((item) => item.slotId !== sheetSlot);
    setMedia({
      items: [...others, ...next.map((item) => ({ ...item, slotId: sheetSlot ?? undefined }))],
      uploaded: false,
    });
  };

  const openSlot = (slotId: string, _field: FormField) => {
    setSheetSlot(slotId);
    setMediaOpen(true);
  };

  const slotCount = (slotId: string) =>
    mediaItems.filter((item) => item.slotId === slotId).length;

  const mediaCountBySlot = Object.fromEntries(mediaSlots.map((field) => [field.id, slotCount(field.id)]));

  return (
    <View style={styles.screen}>
      <TopBar
        title={service?.name ?? 'Job scope'}
        onBack={paged && currentStep > 0 ? onPreviousStep : requestBack}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close and save options"
            hitSlop={8}
            onPress={requestExit}
            style={styles.close}>
            <X size={22} color={colors.text} strokeWidth={2} />
          </Pressable>
        }
      />
      <StepperHeader current={1} />
      {sheet}

      <KeyboardScreen
        contentContainerStyle={styles.content}
        footer={
          <SummaryBar
            caption={
              showErrors && Object.keys(errors).length > 0
                ? `${Object.keys(errors).length} required detail${
                    Object.keys(errors).length === 1 ? '' : 's'
                  } missing`
                : `${details.cleaners} cleaner${
                    details.cleaners === 1 ? '' : 's'
                  } · ${details.hours} h`
            }
            total={quote.total}
            actionLabel={
              paged && currentStep < stepCount - 1
                ? 'Next'
                : service?.pricingMode === 'quote'
                  ? 'Request quote'
                  : 'Continue'
            }
            onPress={onNext}
            onDetailsPress={() => setSummaryOpen(true)}
            secondaryLabel={paged && currentStep > 0 ? 'Back' : undefined}
            onSecondaryPress={onPreviousStep}
          />
        }>
        {!paged || currentStep === 0 ? (
          <View style={styles.section}>
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>
              {schema.heading}
            </Text>
            <Text style={styles.caption} maxFontSizeMultiplier={1.3}>
              {schema.mediaHint || 'Helps us send the right team and time.'}
            </Text>
          </View>
        ) : null}

        {paged ? (
          <View style={styles.stepLine}>
            <Text style={styles.stepLabel} maxFontSizeMultiplier={1.3}>
              Step {currentStep + 1} of {stepCount}
            </Text>
            <View style={styles.stepDots} accessibilityLabel={`Step ${currentStep + 1} of ${stepCount}`}>
              {schema.sections.map((section, index) => (
                <View
                  key={section.id}
                  style={[styles.stepDot, index === currentStep && styles.stepDotOn]}
                />
              ))}
            </View>
          </View>
        ) : null}

        <DynamicForm
          schema={
            paged && activeSection ? { ...schema, sections: [activeSection] } : schema
          }
          answers={scope.answers}
          onChange={onAnswer}
          errors={showErrors ? stepErrors : undefined}
          mediaCountBySlot={mediaCountBySlot}
          onMediaPress={openSlot}
        />

        {showSuggestion && suggestion && (!paged || currentStep === stepCount - 1) ? (
          <View style={styles.suggestion}>
            <Sparkles size={18} color={colors.green700} strokeWidth={2} />
            <View style={styles.suggestionText}>
              <Text style={styles.suggestionTitle} maxFontSizeMultiplier={1.3}>
                Suggested time
              </Text>
              <Text style={styles.suggestionBody} maxFontSizeMultiplier={1.3}>
                These details usually take {suggestionCopy(suggestion)}.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply suggested time"
              onPress={applySuggestion}
              style={styles.apply}>
              <Text style={styles.applyText} maxFontSizeMultiplier={1.2}>
                Apply
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss suggestion"
              hitSlop={8}
              onPress={() => setSuggestionDismissed(true)}>
              <X size={16} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
        ) : null}

        {!paged || currentStep === stepCount - 1 ? (
        <View style={styles.section}>
          <Text style={styles.label} maxFontSizeMultiplier={1.3}>
            Photos and video
          </Text>
          <Text style={styles.caption} maxFontSizeMultiplier={1.3}>
            Up to {jobMedia.maxItems} files, {jobMedia.maxVideos} of them video. Optional unless a
            photo slot above asks for one.
          </Text>
          <View style={styles.mediaRow}>
            {mediaItems.map((item, index) => (
              <MediaTile
                key={item.id}
                item={item}
                index={index}
                total={mediaItems.length}
                onPress={() => setPreviewItem(item)}
                onRemove={() => onRemoveMedia(item.id)}
              />
            ))}
            {mediaItems.length < jobMedia.maxItems ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photos or video"
                onPress={() => {
                  selectionHaptic();
                  setSheetSlot(null);
                  setMediaOpen(true);
                }}
                style={styles.addMedia}>
                <Plus size={22} color={colors.green700} strokeWidth={2} />
                <Text style={styles.addMediaText} maxFontSizeMultiplier={1.2}>
                  Add
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        ) : null}

        {!paged || currentStep === stepCount - 1 ? (
        <View style={styles.note}>
          <Info size={16} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.noteText} maxFontSizeMultiplier={1.3}>
            {service?.pricingMode === 'quote'
              ? 'We confirm the price after reviewing these details.'
              : 'Hours and team size stay editable until you pay.'}
          </Text>
        </View>
        ) : null}
      </KeyboardScreen>

      <SummarySheet
        visible={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        serviceName={service?.name}
        draft={active}
      />

      <MediaSheet
        visible={mediaOpen}
        items={sheetItems}
        onClose={() => setMediaOpen(false)}
        onChange={onSheetChange}
        onRemove={onRemoveMedia}
        onPreview={setPreviewItem}
      />

      <MediaPreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onRemove={onRemoveMedia}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space[4], paddingBottom: space[8], gap: space[5] },
  section: { gap: space[1] },
  title: { ...text.h2 },
  caption: { ...text.caption, color: colors.textMuted },
  stepLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  stepLabel: { ...text.caption, fontFamily: font.bodySemi, color: colors.green700 },
  stepDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  stepDotOn: { width: 16, backgroundColor: colors.green500 },
  label: { ...text.bodyM, fontFamily: font.bodySemi },
  close: { padding: space[1] },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.input,
    backgroundColor: colors.green50,
  },
  suggestionText: { flex: 1, gap: 2 },
  suggestionTitle: { ...text.caption, fontFamily: font.bodySemi, color: colors.green700 },
  suggestionBody: { ...text.caption, color: colors.textMuted },
  apply: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.green500,
  },
  applyText: { ...text.caption, fontFamily: font.bodySemi, color: colors.surface },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
  addMedia: {
    width: 96,
    height: 96,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addMediaText: { ...text.caption, color: colors.green700 },
  note: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  noteText: { ...text.caption, color: colors.textMuted, flex: 1 },
});

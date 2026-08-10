import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useAppColors } from '@/contexts/AppearanceContext';
import { AacaButton, AacaCard, ProgressBar } from '@/components/UIKit';
import { ZelligePattern, ZelligeBand } from '@/components/ZelligePattern';
import { GRADIENTS, SIZES, FONTS, DARK_COLORS, MOROCCAN } from '@/theme';
import { getCurrentOffering, purchasePackage, restorePurchases } from '@/lib/purchases';

const GOLD_GRADIENT: [string, string] = ['#F3CD62', MOROCCAN.gold];

const FEATURES: { icon: string; label: string }[] = [
    { icon: 'infinity', label: 'Notes illimitées, chaque mois' },
    { icon: 'brain', label: 'Résumés, quiz et flashcards IA sans restriction' },
    { icon: 'flash-outline', label: 'Traitement prioritaire de vos captures' },
];

/** Staggered fade + rise entrance — one orchestrated reveal, not scattered micro-animations. */
function useStagger(count: number, delayStep = 90) {
    const values = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
    useEffect(() => {
        Animated.stagger(
            delayStep,
            values.map((v) => Animated.timing(v, { toValue: 1, duration: 420, useNativeDriver: true }))
        ).start();
        // run the entrance once on mount; values/delayStep are stable for the component's lifetime
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return values.map((v) => ({
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    }));
}

export default function PaywallScreen() {
    const { auth, refreshPremiumStatus, setPremiumOptimistic } = useAuth();
    const C = useAppColors();
    const insets = useSafeAreaInsets();
    const [offering, setOffering] = useState<any>(null);
    const [loadingOffering, setLoadingOffering] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);

    const crownScale = useRef(new Animated.Value(0.6)).current;
    const [heroAnim, quotaAnim, featuresAnim, offerAnim] = useStagger(4);

    useEffect(() => {
        Animated.spring(crownScale, { toValue: 1, friction: 5, tension: 60, delay: 120, useNativeDriver: true }).start();
        // run the entrance once on mount; crownScale is a stable ref
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const current = await getCurrentOffering();
                setOffering(current);
            } catch {
                // Best effort — offering stays null; the UI already handles that gracefully.
            } finally {
                setLoadingOffering(false);
            }
        })();
    }, []);

    const monthlyPackage = offering?.monthly ?? offering?.availablePackages?.[0] ?? null;

    const handlePurchase = useCallback(async () => {
        if (!monthlyPackage) {
            Alert.alert('Indisponible', "L'offre premium n'est pas encore configurée. Réessayez plus tard.");
            return;
        }
        setPurchasing(true);
        try {
            const unlocked = await purchasePackage(monthlyPackage);
            if (unlocked) {
                await refreshPremiumStatus();
                // Always applied last: a stale server read from refreshPremiumStatus() must
                // never clobber the premium unlock we just paid for.
                setPremiumOptimistic();
                Alert.alert('Bienvenue dans Premium', 'Votre abonnement est actif. Bonne étude !');
                router.back();
            }
        } catch (e: any) {
            if (e?.userCancelled) return;
            Alert.alert('Erreur', "L'achat n'a pas pu être finalisé. Réessayez.");
        } finally {
            setPurchasing(false);
        }
    }, [monthlyPackage, refreshPremiumStatus, setPremiumOptimistic]);

    const handleRestore = useCallback(async () => {
        setRestoring(true);
        try {
            const unlocked = await restorePurchases();
            await refreshPremiumStatus();
            if (unlocked) {
                // Always applied last: a stale server read from refreshPremiumStatus() must
                // never clobber the premium unlock we just restored.
                setPremiumOptimistic();
            }
            Alert.alert(
                unlocked ? 'Abonnement restauré' : 'Aucun abonnement trouvé',
                unlocked ? 'Votre accès premium a été restauré.' : "Aucun achat premium actif n'a été trouvé sur ce compte."
            );
            if (unlocked) router.back();
        } catch {
            Alert.alert('Erreur', "La restauration n'a pas pu aboutir. Réessayez.");
        } finally {
            setRestoring(false);
        }
    }, [refreshPremiumStatus, setPremiumOptimistic]);

    const priceLabel = monthlyPackage?.product?.priceString ?? '—';

    return (
        <View style={[styles.container, { backgroundColor: C.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SIZES.md }]} showsVerticalScrollIndicator={false}>
                <Animated.View style={[styles.hero, heroAnim]}>
                    <LinearGradient colors={GRADIENTS.hero} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.heroPattern}>
                        <ZelligePattern color={MOROCCAN.gold} opacity={0.35} tileSize={26} cols={10} rows={5} />
                    </View>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={styles.closeBtn}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="close" size={18} color={DARK_COLORS.textSecondary} />
                    </TouchableOpacity>

                    <Animated.View style={[styles.crown, { transform: [{ scale: crownScale }] }]}>
                        <LinearGradient colors={GOLD_GRADIENT} style={StyleSheet.absoluteFillObject} />
                        <MaterialCommunityIcons name="crown" size={28} color={DARK_COLORS.background} />
                    </Animated.View>
                    <Text style={[FONTS.h2, styles.heroTitle, { color: DARK_COLORS.textPrimary }]}>Passez à Premium</Text>
                    <Text style={[FONTS.body1, styles.heroSub, { color: DARK_COLORS.textSecondary }]}>
                        Débloquez des notes illimitées et toute la puissance de l&apos;IA, sans limite mensuelle.
                    </Text>

                    <View style={styles.heroBand}>
                        <ZelligeBand color={MOROCCAN.gold} opacity={0.5} height={12} />
                    </View>
                </Animated.View>

                <Animated.View style={quotaAnim}>
                    <AacaCard style={styles.quotaCard}>
                        <View style={styles.quotaHeader}>
                            <Text style={[FONTS.body2, { color: C.textSecondary }]}>Votre quota gratuit ce mois-ci</Text>
                            <Text style={[FONTS.h4, { color: C.textPrimary }]}>
                                {auth.notesUsedThisMonth}/{auth.notesQuota}
                            </Text>
                        </View>
                        <ProgressBar
                            value={auth.notesQuota > 0 ? auth.notesUsedThisMonth / auth.notesQuota : 0}
                            color={auth.notesUsedThisMonth >= auth.notesQuota ? C.error : C.primary}
                        />
                    </AacaCard>
                </Animated.View>

                <Animated.View style={[styles.features, featuresAnim]}>
                    {FEATURES.map((f) => (
                        <View key={f.label} style={[styles.featureRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                            <View style={styles.featureIcon}>
                                <MaterialCommunityIcons name={f.icon as any} size={18} color={MOROCCAN.gold} />
                            </View>
                            <Text style={[FONTS.body1, styles.featureLabel, { color: C.textPrimary }]}>{f.label}</Text>
                            <MaterialCommunityIcons name="check-circle" size={16} color={MOROCCAN.gold} style={{ opacity: 0.85 }} />
                        </View>
                    ))}
                </Animated.View>

                <Animated.View style={offerAnim}>
                    <AacaCard style={styles.offerCard} accentColor={MOROCCAN.gold}>
                        {loadingOffering ? (
                            <ActivityIndicator color={MOROCCAN.gold} />
                        ) : (
                            <>
                                <View style={styles.offerPriceRow}>
                                    <Text style={[FONTS.h1, styles.offerPrice, { color: C.textPrimary }]}>{priceLabel}</Text>
                                    <Text style={[FONTS.body1, { color: C.textMuted }]}>/ mois</Text>
                                </View>
                                <View style={styles.offerSubRow}>
                                    <MaterialCommunityIcons name="shield-check-outline" size={14} color={C.textMuted} />
                                    <Text style={[FONTS.body2, styles.offerSub, { color: C.textMuted }]}>Résiliable à tout moment</Text>
                                </View>
                            </>
                        )}
                    </AacaCard>

                    <TouchableOpacity
                        activeOpacity={0.88}
                        disabled={loadingOffering || purchasing}
                        onPress={handlePurchase}
                        style={[styles.subscribeBtn, (loadingOffering || purchasing) && { opacity: 0.6 }]}
                    >
                        <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                        {purchasing ? (
                            <ActivityIndicator size="small" color={DARK_COLORS.background} />
                        ) : (
                            <MaterialCommunityIcons name="crown-outline" size={18} color={DARK_COLORS.background} />
                        )}
                        <Text style={styles.subscribeLabel}>S&apos;abonner</Text>
                    </TouchableOpacity>

                    <AacaButton
                        label="Restaurer mes achats"
                        variant="ghost"
                        full
                        loading={restoring}
                        disabled={restoring}
                        onPress={handleRestore}
                        style={styles.restoreBtn}
                    />
                    <Text
                        style={[FONTS.caption, styles.closeLink, { color: C.textMuted }]}
                        onPress={() => router.back()}
                    >
                        Pas maintenant
                    </Text>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.xxl, gap: SIZES.lg },
    hero: {
        borderRadius: SIZES.borderRadiusXl,
        overflow: 'hidden',
        alignItems: 'center',
        paddingTop: SIZES.xxl,
        paddingBottom: SIZES.lg,
        paddingHorizontal: SIZES.lg,
    },
    heroPattern: { ...StyleSheet.absoluteFillObject },
    closeBtn: {
        position: 'absolute', top: SIZES.md, right: SIZES.md,
        width: 30, height: 30, borderRadius: SIZES.borderRadiusFull,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    crown: {
        width: 64, height: 64, borderRadius: SIZES.borderRadiusFull,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        marginBottom: SIZES.md,
        shadowColor: MOROCCAN.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
    },
    heroTitle: { textAlign: 'center', marginBottom: SIZES.xs },
    heroSub: { textAlign: 'center', maxWidth: 280 },
    heroBand: { marginTop: SIZES.lg, width: '60%' },
    quotaCard: { gap: SIZES.sm },
    quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    features: { gap: SIZES.sm },
    featureRow: {
        flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
        borderWidth: 1, borderRadius: SIZES.borderRadiusLg,
        paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md,
    },
    featureIcon: {
        width: 34, height: 34, borderRadius: SIZES.borderRadius, alignItems: 'center', justifyContent: 'center',
        backgroundColor: MOROCCAN.goldSoft + '22', borderWidth: 1, borderColor: MOROCCAN.gold + '3A',
    },
    featureLabel: { flex: 1 },
    offerCard: { alignItems: 'center', paddingVertical: SIZES.lg, marginBottom: SIZES.md },
    offerPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SIZES.xs },
    offerPrice: { lineHeight: SIZES.fontTitle + 2 },
    offerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SIZES.xs },
    offerSub: {},
    subscribeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.xs,
        minHeight: 52, borderRadius: SIZES.borderRadius, overflow: 'hidden',
        shadowColor: MOROCCAN.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
    },
    subscribeLabel: { color: DARK_COLORS.background, fontSize: SIZES.fontSm, fontWeight: '800', letterSpacing: 0.2 },
    restoreBtn: { marginTop: SIZES.sm },
    closeLink: { textAlign: 'center', marginTop: SIZES.sm, textDecorationLine: 'underline' },
});

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { initMobileAuth, mobileDemoLogin, mobileGetMe } from '../src/api-client';

export default function MobileFriendEntryScreen() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPersonas, setShowPersonas] = useState(false);
  const [loggingInRole, setLoggingInRole] = useState<'client' | 'developer' | 'admin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const token = await initMobileAuth();
        if (token) {
          const me = await mobileGetMe().catch(() => null);
          if (me) {
            router.replace('/(app)');
            return;
          }
        }
      } catch {
        // Continue to landing entry
      } finally {
        setCheckingAuth(false);
      }
    }
    checkExistingSession();
  }, []);

  const handleDemoSelect = async (role: 'client' | 'developer' | 'admin') => {
    if (loggingInRole) return;
    setLoggingInRole(role);
    setError(null);

    try {
      await mobileDemoLogin(role);
      router.replace('/(app)');
    } catch (err: any) {
      setError(err.message || 'Unable to connect to demo server. Please check your internet connection.');
    } finally {
      setLoggingInRole(null);
    }
  };

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Initializing IntentFlow...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <ScrollView contentContainerStyle={styles.container} bounces={false}>
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>IntentFlow</Text>
          </View>
          <Text style={styles.mainTitle}>
            AI turns messy communication into <Text style={styles.highlightText}>structured work.</Text>
          </Text>
          <Text style={styles.subtitle}>
            A mobile client collaboration platform with human-in-the-loop verification.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {!showPersonas ? (
          /* Main Entry Action */
          <View style={styles.actionCard}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowPersonas(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Explore Demo →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Sign In with Account</Text>
            </TouchableOpacity>

            <View style={styles.featurePillsRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>⚡ Zero Sign-Up Required</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>🛡️ Real Live Data</Text>
              </View>
            </View>
          </View>
        ) : (
          /* Persona Selection Cards */
          <View style={styles.personaSection}>
            <View style={styles.personaHeaderRow}>
              <Text style={styles.personaTitle}>Choose how you want to explore</Text>
              <TouchableOpacity onPress={() => setShowPersonas(false)}>
                <Text style={styles.backLink}>Back</Text>
              </TouchableOpacity>
            </View>

            {/* Persona 1: Client */}
            <TouchableOpacity
              style={[styles.personaCard, loggingInRole === 'client' && styles.personaCardActive]}
              onPress={() => handleDemoSelect('client')}
              disabled={Boolean(loggingInRole)}
              activeOpacity={0.8}
            >
              <View style={styles.personaTopRow}>
                <View style={[styles.personaIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Text style={styles.personaIcon}>💬</Text>
                </View>
                <View style={styles.personaTitleColumn}>
                  <Text style={styles.personaName}>Client Persona</Text>
                  <Text style={styles.personaSubtitle}>Stakeholder & Reviewer</Text>
                </View>
                {loggingInRole === 'client' ? (
                  <ActivityIndicator size="small" color="#38BDF8" />
                ) : (
                  <Text style={styles.arrowIcon}>→</Text>
                )}
              </View>
              <Text style={styles.personaDescription}>
                • Review conversation threads{'\n'}
                • Track project milestone progress{'\n'}
                • Approve deliverables & request revisions
              </Text>
            </TouchableOpacity>

            {/* Persona 2: Developer */}
            <TouchableOpacity
              style={[styles.personaCard, loggingInRole === 'developer' && styles.personaCardActive]}
              onPress={() => handleDemoSelect('developer')}
              disabled={Boolean(loggingInRole)}
              activeOpacity={0.8}
            >
              <View style={styles.personaTopRow}>
                <View style={[styles.personaIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                  <Text style={styles.personaIcon}>🛠️</Text>
                </View>
                <View style={styles.personaTitleColumn}>
                  <Text style={styles.personaName}>Developer Persona</Text>
                  <Text style={styles.personaSubtitle}>Engineering & Delivery</Text>
                </View>
                {loggingInRole === 'developer' ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text style={styles.arrowIcon}>→</Text>
                )}
              </View>
              <Text style={styles.personaDescription}>
                • Review AI-extracted functional requirements{'\n'}
                • Confirm or adjust intent scope{'\n'}
                • Manage tasks & submit deliverables
              </Text>
            </TouchableOpacity>

            {/* Persona 3: Workspace Admin */}
            <TouchableOpacity
              style={[styles.personaCard, loggingInRole === 'admin' && styles.personaCardActive]}
              onPress={() => handleDemoSelect('admin')}
              disabled={Boolean(loggingInRole)}
              activeOpacity={0.8}
            >
              <View style={styles.personaTopRow}>
                <View style={[styles.personaIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Text style={styles.personaIcon}>⚡</Text>
                </View>
                <View style={styles.personaTitleColumn}>
                  <Text style={styles.personaName}>Workspace Admin</Text>
                  <Text style={styles.personaSubtitle}>Agency Operations</Text>
                </View>
                {loggingInRole === 'admin' ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <Text style={styles.arrowIcon}>→</Text>
                )}
              </View>
              <Text style={styles.personaDescription}>
                • Manage organization & team members{'\n'}
                • Project directory and timeline oversight{'\n'}
                • Agency-wide activity audit log
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            IntentFlow Mobile Preview v1.0.0 · Powered by Fastify & PostgreSQL
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  brandHeader: {
    marginTop: 20,
    marginBottom: 24,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  logoText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  highlightText: {
    color: '#818CF8',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  actionCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 14,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
    minHeight: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  featurePillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  featurePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featurePillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  personaSection: {
    gap: 14,
  },
  personaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  personaTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  backLink: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
    padding: 6,
  },
  personaCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  personaCardActive: {
    borderColor: '#6366F1',
    backgroundColor: '#172033',
  },
  personaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  personaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personaIcon: {
    fontSize: 20,
  },
  personaTitleColumn: {
    flex: 1,
  },
  personaName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  personaSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  arrowIcon: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '800',
  },
  personaDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  footerNote: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
  },
});

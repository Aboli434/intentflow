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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { initMobileAuth, mobileGetMe } from '../src/api-client';

export default function MobileProductionEntryScreen() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Intent...</Text>
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
            <Text style={styles.logoText}>Intent</Text>
          </View>
          <Text style={styles.mainTitle}>
            Turn communication into <Text style={styles.highlightText}>structured work.</Text>
          </Text>
          <Text style={styles.subtitle}>
            A unified client collaboration platform with human-in-the-loop verification, real-time activity, deliverables, and role-based workspaces.
          </Text>
        </View>

        {/* Value Highlights */}
        <View style={styles.highlightsContainer}>
          <View style={styles.highlightItem}>
            <View style={[styles.highlightIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Text style={styles.highlightIcon}>✨</Text>
            </View>
            <View style={styles.highlightTextCol}>
              <Text style={styles.highlightTitle}>AI Intent Processing</Text>
              <Text style={styles.highlightDesc}>Automatically extracts actionable scope & requirements.</Text>
            </View>
          </View>

          <View style={styles.highlightItem}>
            <View style={[styles.highlightIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Text style={styles.highlightIcon}>🛡️</Text>
            </View>
            <View style={styles.highlightTextCol}>
              <Text style={styles.highlightTitle}>Multi-Tenant RBAC</Text>
              <Text style={styles.highlightDesc}>Tailored workspaces for Admins, Developers, and Clients.</Text>
            </View>
          </View>

          <View style={styles.highlightItem}>
            <View style={[styles.highlightIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={styles.highlightIcon}>📦</Text>
            </View>
            <View style={styles.highlightTextCol}>
              <Text style={styles.highlightTitle}>Milestones & Deliverables</Text>
              <Text style={styles.highlightDesc}>Review deliverables, request revisions, and sign off with audit logs.</Text>
            </View>
          </View>
        </View>

        {/* Authentication Actions */}
        <View style={styles.actionCard}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <View style={styles.securityRow}>
            <Text style={styles.securityText}>🔒 End-to-end encrypted session & multi-tenant isolation</Text>
          </View>
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Intent · Enterprise Client Collaboration
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
    marginBottom: 20,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
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
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 30,
    lineHeight: 38,
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
    lineHeight: 22,
    color: '#94A3B8',
    fontWeight: '500',
  },
  highlightsContainer: {
    gap: 16,
    marginVertical: 12,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  highlightIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightIcon: {
    fontSize: 20,
  },
  highlightTextCol: {
    flex: 1,
  },
  highlightTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  highlightDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  actionCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 12,
    marginTop: 10,
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
  securityRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  securityText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  footerNote: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
  },
});

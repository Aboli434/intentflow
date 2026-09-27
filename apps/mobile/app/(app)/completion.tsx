import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  mobileGetProjectCompletionStatus,
  mobileGetProjectCompletionChecklist,
  mobileGetProjectClosures,
  mobileApproveProjectClosure,
  mobileRequestClosureChanges,
  mobileGetProjectHandoff,
  mobileAcknowledgeProjectHandoff,
} from '../../src/api-client';

export default function CompletionScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId || '';

  const [eligibility, setEligibility] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [activeClosure, setActiveClosure] = useState<any>(null);
  const [handoff, setHandoff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [eligRes, chkRes, closuresRes] = await Promise.all([
        mobileGetProjectCompletionStatus(projectId),
        mobileGetProjectCompletionChecklist(projectId),
        mobileGetProjectClosures(projectId),
      ]);
      setEligibility(eligRes);
      setChecklist(chkRes);
      if (closuresRes && closuresRes.length > 0) {
        setActiveClosure(closuresRes[0]);
      } else {
        setActiveClosure(null);
      }

      try {
        const hRes = await mobileGetProjectHandoff(projectId);
        setHandoff(hRes);
      } catch {
        setHandoff(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project completion data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApproveClosure = async () => {
    if (!activeClosure) return;
    try {
      await mobileApproveProjectClosure(activeClosure.id);
      Alert.alert('Approved!', 'Project completion approved successfully.');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve completion.');
    }
  };

  const handleRequestChanges = async () => {
    if (!activeClosure) return;
    Alert.prompt(
      'Request Completion Changes',
      'Explain what changes are required before final project closure:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (comment) => {
            if (!comment || !comment.trim()) {
              Alert.alert('Error', 'Comment is required.');
              return;
            }
            try {
              await mobileRequestClosureChanges(activeClosure.id, comment);
              Alert.alert('Submitted', 'Changes requested on project closure.');
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to request changes.');
            }
          },
        },
      ]
    );
  };

  const handleAcknowledgeHandoff = async () => {
    if (!handoff) return;
    try {
      await mobileAcknowledgeProjectHandoff(handoff.id);
      Alert.alert('Acknowledged', 'Project handoff acknowledged.');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to acknowledge handoff.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>✅ Completion & Handoff</Text>
        <Text style={styles.subtitle}>Project closure status and final handoff package</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading completion status...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Readiness Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>COMPLETION READINESS</Text>
              <Text style={eligibility?.eligible ? styles.eligibleTag : styles.blockerTag}>
                {eligibility?.eligible ? '✓ Eligible' : `⚠️ ${eligibility?.blockers?.length} Blockers`}
              </Text>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricNum}>{eligibility?.completedWorkCount || 0}</Text>
                <Text style={styles.metricLabel}>Work Completed</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricNum}>{eligibility?.approvedDeliverablesCount || 0}</Text>
                <Text style={styles.metricLabel}>Deliverables Approved</Text>
              </View>
            </View>
          </View>

          {/* Active Closure Request Card */}
          {activeClosure && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>CLOSURE REQUEST</Text>
                <Text style={styles.statusBadge}>{activeClosure.status}</Text>
              </View>

              {activeClosure.summary ? (
                <Text style={styles.summaryText}>{activeClosure.summary}</Text>
              ) : null}

              {activeClosure.status === 'pending_client_approval' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.approveBtn} onPress={handleApproveClosure}>
                    <Text style={styles.approveBtnText}>✓ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.changesBtn} onPress={handleRequestChanges}>
                    <Text style={styles.changesBtnText}>↻ Request Changes</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Handoff Card */}
          {handoff && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>FINAL HANDOFF PACKAGE</Text>
                <Text style={styles.statusBadge}>{handoff.handoffStatus}</Text>
              </View>

              <Text style={styles.summaryText}>{handoff.summary || 'Handoff deliverables ready.'}</Text>

              {handoff.handoffStatus !== 'acknowledged' ? (
                <TouchableOpacity style={styles.approveBtn} onPress={handleAcknowledgeHandoff}>
                  <Text style={styles.approveBtnText}>Acknowledge Handoff</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.acknowledgedText}>✓ Handoff Acknowledged</Text>
              )}
            </View>
          )}

          {/* Checklist */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>COMPLETION CHECKLIST</Text>
            <View style={{ marginTop: 8 }}>
              {checklist.map((item) => (
                <View key={item.id} style={styles.checkItem}>
                  <Text style={styles.checkIcon}>{item.status === 'completed' ? '✅' : '○'}</Text>
                  <Text style={styles.checkText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 1,
  },
  eligibleTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#34d399',
  },
  blockerTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#38bdf8',
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginVertical: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricNum: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  metricLabel: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  changesBtn: {
    flex: 1,
    backgroundColor: '#78350f',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  changesBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fef3c7',
  },
  acknowledgedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#34d399',
    marginTop: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  checkText: {
    fontSize: 12,
    color: '#e2e8f0',
  },
  errorBanner: {
    margin: 16,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#fca5a5',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
});

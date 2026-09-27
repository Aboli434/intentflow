import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Deliverable } from '@intentflow/types';
import {
  mobileGetDeliverableDetail,
  mobileApproveDeliverable,
  mobileRequestDeliverableChanges,
} from '../../../src/api-client';

export default function DeliverableDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [showRequestInput, setShowRequestInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await mobileGetDeliverableDetail(id);
      setDeliverable(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load deliverable details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await mobileApproveDeliverable(id, comment || undefined);
      Alert.alert('Approved!', 'Deliverable was approved successfully.');
      fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to approve deliverable');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!id || !comment.trim()) {
      setError('Comment is required when requesting changes');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await mobileRequestDeliverableChanges(id, comment);
      Alert.alert('Submitted', 'Revision request submitted to developers.');
      setShowRequestInput(false);
      fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to request changes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading deliverable...</Text>
      </View>
    );
  }

  if (error || !deliverable) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Deliverable not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.topBack} onPress={() => router.back()}>
        <Text style={styles.topBackText}>← Deliverables</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{deliverable.title}</Text>
          <Text style={styles.statusBadge}>{deliverable.status}</Text>
        </View>

        {deliverable.description ? (
          <Text style={styles.description}>{deliverable.description}</Text>
        ) : null}

        {/* Linked Work Items */}
        {deliverable.linkedWorkItems && deliverable.linkedWorkItems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LINKED EXECUTION ITEMS</Text>
            {deliverable.linkedWorkItems.map((wi) => (
              <View key={wi.id} style={styles.wiItem}>
                <Text style={styles.wiText}>✓ {wi.title}</Text>
                <Text style={styles.wiStatus}>{wi.status}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Attachments */}
        {deliverable.attachments && deliverable.attachments.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ATTACHMENTS</Text>
            {deliverable.attachments.map((att) => (
              <View key={att.id} style={styles.attItem}>
                <Text style={styles.attName}>📄 {att.fileName}</Text>
                <Text style={styles.attSize}>{(att.size / 1024).toFixed(1)} KB</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Revisions History */}
        {deliverable.revisions && deliverable.revisions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REVISION HISTORY</Text>
            {deliverable.revisions.map((rev) => (
              <View key={rev.id} style={styles.revCard}>
                <Text style={styles.revClient}>{rev.clientName || 'Client'} ({rev.status})</Text>
                <Text style={styles.revDesc}>{rev.description}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Approval Actions for Client */}
      {deliverable.status !== 'approved' ? (
        <View style={styles.actionsContainer}>
          {!showRequestInput ? (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.requestBtn}
                onPress={() => setShowRequestInput(true)}
              >
                <Text style={styles.requestBtnText}>↻ Request Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveBtn}
                disabled={submitting}
                onPress={handleApprove}
              >
                <Text style={styles.approveBtnText}>
                  {submitting ? 'Approving...' : '✓ Approve Deliverable'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>Required Change Comments *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholder="Explain requested changes in detail..."
                placeholderTextColor="#64748b"
                value={comment}
                onChangeText={setComment}
              />
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowRequestInput(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitReqBtn}
                  disabled={submitting}
                  onPress={handleRequestChanges}
                >
                  <Text style={styles.submitReqBtnText}>
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.approvedBanner}>
          <Text style={styles.approvedText}>✓ Deliverable Approved</Text>
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
  content: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  topBack: {
    marginBottom: 12,
  },
  topBackText: {
    color: '#38bdf8',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#38bdf8',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  description: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 8,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 6,
  },
  wiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  wiText: {
    fontSize: 11,
    color: '#38bdf8',
  },
  wiStatus: {
    fontSize: 10,
    color: '#94a3b8',
  },
  attItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  attName: {
    fontSize: 11,
    color: '#f1f5f9',
  },
  attSize: {
    fontSize: 10,
    color: '#64748b',
  },
  revCard: {
    backgroundColor: '#1e1b4b',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  revClient: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#a78bfa',
  },
  revDesc: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  actionsContainer: {
    marginTop: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  requestBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  requestBtnText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inputBox: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    padding: 8,
    color: '#f8fafc',
    fontSize: 12,
    minHeight: 60,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  submitReqBtn: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  submitReqBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  approvedBanner: {
    marginTop: 16,
    padding: 14,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderRadius: 8,
    alignItems: 'center',
  },
  approvedText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
  errorText: {
    fontSize: 12,
    color: '#fca5a5',
  },
  backBtn: {
    marginTop: 12,
    padding: 8,
  },
  backBtnText: {
    color: '#38bdf8',
    fontSize: 12,
  },
});

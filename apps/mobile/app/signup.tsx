import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { mobileSignup } from '../src/api-client';

export default function MobileSignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await mobileSignup(name, email, password);
      router.replace('/(app)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>IntentFlow Mobile</Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Register for collaborative project workspace</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor="#64748b"
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')} style={styles.linkButton}>
          <Text style={styles.linkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  badge: {
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    fontSize: 12,
    fontFamily: 'Courier',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  error: {
    color: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#38bdf8',
    fontSize: 13,
  },
});

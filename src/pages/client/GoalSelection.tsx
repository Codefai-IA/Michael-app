import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, TrendingUp, Scale, Heart, Dumbbell, Target } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';
import type { GoalType } from '../../types/database';
import styles from './GoalSelection.module.css';

const GOAL_OPTIONS: { value: GoalType; label: string; icon: React.ReactNode }[] = [
  { value: 'perder_peso', label: 'Perder Peso', icon: <TrendingDown size={28} /> },
  { value: 'ganhar_massa', label: 'Ganhar Massa Muscular', icon: <TrendingUp size={28} /> },
  { value: 'definicao', label: 'Definicao Muscular', icon: <Dumbbell size={28} /> },
  { value: 'manter_peso', label: 'Manter Peso', icon: <Scale size={28} /> },
  { value: 'melhorar_saude', label: 'Melhorar Saude', icon: <Heart size={28} /> },
];

const GOAL_LABELS: Record<GoalType, string> = {
  perder_peso: 'Perder Peso',
  ganhar_massa: 'Ganhar Massa Muscular',
  definicao: 'Definicao Muscular',
  manter_peso: 'Manter Peso',
  melhorar_saude: 'Melhorar Saude',
};

export function GoalSelection() {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [goalWeight, setGoalWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const firstName = profile?.full_name?.split(' ')[0] || '';

  async function handleSubmit() {
    if (!selectedGoal) {
      setError('Selecione seu objetivo');
      return;
    }

    if (!goalWeight || Number(goalWeight) <= 0) {
      setError('Informe seu peso meta');
      return;
    }

    if (!user?.id) return;

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          goal_type: selectedGoal,
          goal_weight_kg: Number(goalWeight),
          goals: GOAL_LABELS[selectedGoal],
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      navigate('/app', { replace: true });
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo-icon.png" alt="Logo" className={styles.logoImg} />
        </div>
      </div>

      <div className={styles.formCard}>
        <h1 className={styles.title}>
          Ola, {firstName}!
        </h1>
        <p className={styles.subtitle}>Qual e o seu objetivo?</p>

        <div className={styles.goalGrid}>
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`${styles.goalCard} ${selectedGoal === option.value ? styles.goalCardSelected : ''}`}
              onClick={() => { setSelectedGoal(option.value); setError(''); }}
            >
              <div className={styles.goalIcon}>{option.icon}</div>
              <span className={styles.goalLabel}>{option.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.weightField}>
          <label className={styles.weightLabel}>
            <Target size={18} />
            Peso Meta (kg)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="300"
            value={goalWeight}
            onChange={(e) => { setGoalWeight(e.target.value); setError(''); }}
            placeholder="Ex: 75.0"
            className={styles.weightInput}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <Button
          fullWidth
          onClick={handleSubmit}
          loading={saving}
          disabled={!selectedGoal || !goalWeight}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { supabase } from '../../lib/supabase';
import type { Locale, UnitSystem } from '../../types/database';
import { parseWeightInput, parseHeightInput, weightUnitLabel, heightUnitLabel } from '../../utils/units';
import styles from './AddClientModal.module.css';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  birthDate: string;
  heightCm: string;
  currentWeightKg: string;
  goalWeightKg: string;
  goals: string;
  locale: Locale;
  unitSystem: UnitSystem;
}

const initialFormData: FormData = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  birthDate: '',
  heightCm: '',
  currentWeightKg: '',
  goalWeightKg: '',
  goals: '',
  locale: 'pt-BR',
  unitSystem: 'metric',
};

const LOCALE_OPTIONS = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'Inglês (English)' },
];

const UNIT_SYSTEM_OPTIONS = [
  { value: 'metric', label: 'Métrico (kg / cm)' },
  { value: 'imperial', label: 'Imperial (lb / in)' },
];

function calcAgeFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function AddClientModal({ isOpen, onClose, onSuccess }: AddClientModalProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validations
    if (!formData.fullName.trim()) {
      setError('Nome completo é obrigatório');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email é obrigatório');
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Senha deve ter pelo menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName.trim(),
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este email já está cadastrado');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Erro ao criar usuário');
        setLoading(false);
        return;
      }

      // 2. Create/update profile in profiles table
      const currentWeightKg = parseWeightInput(formData.currentWeightKg, formData.unitSystem);
      const profileData = {
        id: authData.user.id,
        role: 'client' as const,
        full_name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        birth_date: formData.birthDate || null,
        age: calcAgeFromBirthDate(formData.birthDate),
        // O banco guarda sempre metrico: o que o nutri digitou em lb/in vira kg/cm aqui.
        height_cm: parseHeightInput(formData.heightCm, formData.unitSystem),
        current_weight_kg: currentWeightKg,
        starting_weight_kg: currentWeightKg,
        goal_weight_kg: parseWeightInput(formData.goalWeightKg, formData.unitSystem),
        goals: formData.goals.trim() || null,
        is_active: true,
        coaching_start_date: new Date().toISOString().split('T')[0],
        locale: formData.locale,
        unit_system: formData.unitSystem,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (profileError) {
        console.error('Profile error:', profileError);
        setError('Usuário criado, mas erro ao salvar perfil: ' + profileError.message);
        setLoading(false);
        return;
      }

      // Success!
      setFormData(initialFormData);
      setLoading(false);
      onClose();
      // Atualizar lista de clientes em background
      try {
        onSuccess();
      } catch (e) {
        console.error('Erro ao atualizar lista:', e);
      }
    } catch (err) {
      console.error('Error creating client:', err);
      setError('Erro inesperado ao criar cliente');
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setFormData(initialFormData);
      setError(null);
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Novo Aluno">
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Dados de Acesso</h3>
          <Input
            label="Email *"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@exemplo.com"
            disabled={loading}
          />
          <Input
            label="Senha *"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Mínimo 8 caracteres"
            disabled={loading}
          />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Idioma e Unidades</h3>
          <div className={styles.row}>
            <Select
              label="Idioma do app"
              name="locale"
              value={formData.locale}
              onChange={handleChange}
              options={LOCALE_OPTIONS}
              disabled={loading}
            />
            <Select
              label="Unidades"
              name="unitSystem"
              value={formData.unitSystem}
              onChange={handleChange}
              options={UNIT_SYSTEM_OPTIONS}
              disabled={loading}
            />
          </div>
          {formData.locale === 'en' && (
            <p className={styles.hint}>
              O app deste aluno aparecerá em inglês. Textos que você escreve (orientações,
              observações, anamnese) não são traduzidos — escreva-os em inglês.
            </p>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Informações Pessoais</h3>
          <Input
            label="Nome Completo *"
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Nome do aluno"
            disabled={loading}
          />
          <Input
            label="Telefone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(00) 00000-0000"
            disabled={loading}
          />
          <Input
            label="Data de Nascimento"
            type="date"
            name="birthDate"
            value={formData.birthDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Dados Físicos</h3>
          <div className={styles.row}>
            <Input
              label={`Altura (${heightUnitLabel(formData.unitSystem)})`}
              type="number"
              name="heightCm"
              value={formData.heightCm}
              onChange={handleChange}
              placeholder={formData.unitSystem === 'imperial' ? 'Ex: 69' : 'Ex: 175'}
              disabled={loading}
            />
            <Input
              label={`Peso Atual (${weightUnitLabel(formData.unitSystem)})`}
              type="number"
              name="currentWeightKg"
              value={formData.currentWeightKg}
              onChange={handleChange}
              placeholder={formData.unitSystem === 'imperial' ? 'Ex: 154' : 'Ex: 70'}
              disabled={loading}
            />
          </div>
          <Input
            label={`Peso Meta (${weightUnitLabel(formData.unitSystem)})`}
            type="number"
            name="goalWeightKg"
            value={formData.goalWeightKg}
            onChange={handleChange}
            placeholder={formData.unitSystem === 'imperial' ? 'Ex: 143' : 'Ex: 65'}
            disabled={loading}
          />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Objetivos</h3>
          <div className={styles.textareaWrapper}>
            <label className={styles.label}>Objetivos do aluno</label>
            <textarea
              name="goals"
              value={formData.goals}
              onChange={handleChange}
              placeholder="Descreva os objetivos..."
              className={styles.textarea}
              rows={3}
              disabled={loading}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Criar Aluno
          </Button>
        </div>
      </form>
    </Modal>
  );
}

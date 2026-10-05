import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PageContainer, Header } from '../../components/layout';
import { Card, Input, Button } from '../../components/ui';
import type { Anamnesis as AnamnesisType, AnamnesisMainGoal, Profile } from '../../types/database';
import styles from './Anamnesis.module.css';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// Opcoes das perguntas de multipla escolha da call de avaliacao. O valor gravado e a chave em
// ingles (estavel); o rotulo pode mudar sem afetar dado ja salvo.
const MAIN_GOAL_OPTIONS: [AnamnesisMainGoal, string][] = [
  ['weight_loss', 'Emagrecimento'],
  ['muscle_gain', 'Ganho de massa'],
  ['definition', 'Definição'],
  ['performance', 'Performance'],
];
const TRIED_BEFORE_OPTIONS: [string, string][] = [
  ['diet_alone', 'Dieta sozinho'],
  ['nutritionist', 'Nutricionista'],
  ['personal', 'Personal'],
  ['medication', 'Medicamento'],
];
const HUNGER_TIME_OPTIONS: [string, string][] = [
  ['morning', 'Manhã'],
  ['afternoon', 'Tarde'],
  ['night', 'Noite'],
  ['before_bed', 'Antes de dormir'],
];
const WORK_ACTIVITY_OPTIONS: [string, string][] = [
  ['sitting', 'Principalmente sentado'],
  ['standing', 'Principalmente em pé'],
  ['mixed', 'Mista'],
  ['very_active', 'Muito ativo'],
];
const MENTAL_LOAD_OPTIONS: [string, string][] = [
  ['low', 'Pouco'],
  ['medium', 'Médio'],
  ['high', 'Muito'],
];

// Campos de texto livre da anamnese (usados pelos helpers de input/textarea).
type TextField =
  | 'preferred_foods' | 'disliked_foods' | 'supplements' | 'food_allergies' | 'alcohol_consumption'
  | 'current_exercise_type' | 'exercise_duration' | 'routine_exercises' | 'medications' | 'diseases'
  | 'family_history' | 'profession' | 'instagram' | 'referral_source' | 'body_change_wish'
  | 'body_part_bothers' | 'ideal_result' | 'best_result' | 'lost_result_reason' | 'meals_description'
  | 'food_difficulty' | 'cravings_time' | 'weekend_meals' | 'work_hours' | 'training_frequency'
  | 'body_part_to_develop' | 'training_limitations' | 'energy_level';

interface MacroGoals {
  protein_goal: number | null;
  carbs_goal: number | null;
  fats_goal: number | null;
  calories_goal: number | null;
  fiber_goal: number | null;
}

export function Anamnesis() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Profile | null>(null);
  const [anamnesis, setAnamnesis] = useState<Partial<AnamnesisType>>({});
  const [macroGoals, setMacroGoals] = useState<MacroGoals>({
    protein_goal: null,
    carbs_goal: null,
    fats_goal: null,
    calories_goal: null,
    fiber_goal: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchClient();
      fetchAnamnesis();
    }
  }, [id]);

  async function fetchClient() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setClient(data);
      setMacroGoals({
        protein_goal: data.protein_goal,
        carbs_goal: data.carbs_goal,
        fats_goal: data.fats_goal,
        calories_goal: data.calories_goal,
        fiber_goal: data.fiber_goal,
      });
    }
  }

  async function fetchAnamnesis() {
    const { data } = await supabase
      .from('anamnesis')
      .select('*')
      .eq('client_id', id)
      .single();

    if (data) {
      // Corrigir valores antigos do enum se existirem
      if (data.bowel_frequency === 'once_daily') {
        data.bowel_frequency = 'once_a_day';
      }
      if (data.digestion === 'bad') {
        data.digestion = 'poor';
      }
      setAnamnesis(data);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);

    // Enviar apenas os campos válidos da tabela
    const anamnesisData = {
      client_id: id,
      meals_per_day: anamnesis.meals_per_day || null,
      water_liters_per_day: anamnesis.water_liters_per_day || null,
      meal_times: anamnesis.meal_times || null,
      meals_prepared_same_day: anamnesis.meals_prepared_same_day ?? null,
      preferred_foods: anamnesis.preferred_foods || null,
      disliked_foods: anamnesis.disliked_foods || null,
      supplements: anamnesis.supplements || null,
      food_allergies: anamnesis.food_allergies || null,
      gluten_intolerance: anamnesis.gluten_intolerance ?? false,
      alcohol_consumption: anamnesis.alcohol_consumption || null,
      current_exercise_type: anamnesis.current_exercise_type || null,
      exercise_duration: anamnesis.exercise_duration || null,
      routine_exercises: anamnesis.routine_exercises || null,
      weekly_routine: anamnesis.weekly_routine || null,
      health_rating: anamnesis.health_rating || null,
      smoker: anamnesis.smoker ?? false,
      cigarettes_per_day: anamnesis.cigarettes_per_day || null,
      digestion: anamnesis.digestion || null,
      bowel_frequency: anamnesis.bowel_frequency || null,
      medications: anamnesis.medications || null,
      bedtime: anamnesis.bedtime || null,
      wakeup_time: anamnesis.wakeup_time || null,
      sleep_quality: anamnesis.sleep_quality || null,
      sleep_hours: anamnesis.sleep_hours || null,
      diseases: anamnesis.diseases || null,
      family_history: anamnesis.family_history || null,
      profession: anamnesis.profession || null,
      instagram: anamnesis.instagram || null,
      referral_source: anamnesis.referral_source || null,
      main_goal: anamnesis.main_goal || null,
      body_change_wish: anamnesis.body_change_wish || null,
      body_part_bothers: anamnesis.body_part_bothers || null,
      ideal_result: anamnesis.ideal_result || null,
      tried_before: anamnesis.tried_before?.length ? anamnesis.tried_before : null,
      best_result: anamnesis.best_result || null,
      kept_result: anamnesis.kept_result ?? null,
      lost_result_reason: anamnesis.lost_result_reason || null,
      meals_description: anamnesis.meals_description || null,
      food_difficulty: anamnesis.food_difficulty || null,
      hunger_times: anamnesis.hunger_times?.length ? anamnesis.hunger_times : null,
      cravings_time: anamnesis.cravings_time || null,
      weekend_meals: anamnesis.weekend_meals || null,
      work_activity: anamnesis.work_activity || null,
      work_hours: anamnesis.work_hours || null,
      mental_load: anamnesis.mental_load || null,
      trains_currently: anamnesis.trains_currently ?? null,
      training_frequency: anamnesis.training_frequency || null,
      body_part_to_develop: anamnesis.body_part_to_develop || null,
      training_limitations: anamnesis.training_limitations || null,
      energy_level: anamnesis.energy_level || null,
    };

    let error;

    if (anamnesis.id) {
      const result = await supabase
        .from('anamnesis')
        .update(anamnesisData)
        .eq('id', anamnesis.id);
      error = result.error;
    } else {
      const result = await supabase.from('anamnesis').insert(anamnesisData).select().single();
      error = result.error;
      if (result.data) {
        setAnamnesis(result.data);
      }
    }

    // Save macro goals to profiles table
    const { error: goalsError } = await supabase
      .from('profiles')
      .update({
        protein_goal: macroGoals.protein_goal,
        carbs_goal: macroGoals.carbs_goal,
        fats_goal: macroGoals.fats_goal,
        calories_goal: macroGoals.calories_goal,
        fiber_goal: macroGoals.fiber_goal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (error || goalsError) {
      console.error('Erro ao salvar:', error || goalsError);
      alert('Erro ao salvar: ' + (error?.message || goalsError?.message));
    } else {
      alert('Anamnese e metas salvas com sucesso!');
    }
  }

  function updateField<K extends keyof AnamnesisType>(field: K, value: AnamnesisType[K]) {
    setAnamnesis((prev) => ({ ...prev, [field]: value }));
  }

  function toggleInList(field: 'tried_before' | 'hunger_times', value: string) {
    setAnamnesis((prev) => {
      const current = prev[field] || [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  }

  function textArea(field: TextField, label: string, rows = 2) {
    return (
      <div className={styles.field}>
        <label>{label}</label>
        <textarea
          className={styles.textarea}
          value={(anamnesis[field] as string | null) || ''}
          onChange={(e) => updateField(field, e.target.value)}
          rows={rows}
        />
      </div>
    );
  }

  function textInput(field: TextField, label: string, placeholder?: string) {
    return (
      <div className={styles.field}>
        <label>{label}</label>
        <Input
          value={(anamnesis[field] as string | null) || ''}
          onChange={(e) => updateField(field, e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );
  }

  function singleChoice(field: 'main_goal' | 'work_activity' | 'mental_load', label: string, options: [string, string][]) {
    return (
      <div className={styles.field}>
        <label>{label}</label>
        <div className={styles.choiceGroup}>
          {options.map(([value, text]) => (
            <label key={value} className={styles.radio}>
              <input
                type="radio"
                checked={anamnesis[field] === value}
                onChange={() => setAnamnesis((prev) => ({ ...prev, [field]: value }))}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  function multiChoice(field: 'tried_before' | 'hunger_times', label: string, options: [string, string][]) {
    return (
      <div className={styles.field}>
        <label>{label}</label>
        <div className={styles.choiceGroup}>
          {options.map(([value, text]) => (
            <label key={value} className={styles.radio}>
              <input
                type="checkbox"
                checked={(anamnesis[field] || []).includes(value)}
                onChange={() => toggleInList(field, value)}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  function yesNo(field: 'smoker' | 'kept_result' | 'trains_currently', label: string) {
    return (
      <div className={styles.field}>
        <label>{label}</label>
        <div className={styles.radioGroup}>
          <label className={styles.radio}>
            <input type="radio" checked={anamnesis[field] === true} onChange={() => updateField(field, true)} />
            <span>Sim</span>
          </label>
          <label className={styles.radio}>
            <input type="radio" checked={anamnesis[field] === false} onChange={() => updateField(field, false)} />
            <span>Não</span>
          </label>
        </div>
      </div>
    );
  }

  function updateWeeklyRoutine(day: string, value: string) {
    const current = anamnesis.weekly_routine || {};
    setAnamnesis((prev) => ({
      ...prev,
      weekly_routine: { ...current, [day]: value },
    }));
  }

  function updateMacroGoal(field: keyof MacroGoals, value: string) {
    const numValue = value === '' ? null : Number(value);
    setMacroGoals((prev) => {
      const next = { ...prev, [field]: numValue };
      // Calorias = P*4 + C*4 + G*9 (auto-calculado)
      if (field === 'protein_goal' || field === 'carbs_goal' || field === 'fats_goal') {
        const p = field === 'protein_goal' ? numValue : prev.protein_goal;
        const c = field === 'carbs_goal' ? numValue : prev.carbs_goal;
        const f = field === 'fats_goal' ? numValue : prev.fats_goal;
        if (p === null && c === null && f === null) {
          next.calories_goal = null;
        } else {
          next.calories_goal = Math.round((p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9);
        }
      }
      return next;
    });
  }

  if (loading) {
    return (
      <PageContainer hasBottomNav={false}>
        <Header title="Anamnese" showBack />
        <div className={styles.loading}>Carregando...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer hasBottomNav={false}>
      <Header
        title="Anamnese"
        subtitle={client?.full_name}
        showBack
        rightAction={
          <Button size="sm" onClick={handleSave} loading={saving}>
            <Save size={18} />
            Salvar
          </Button>
        }
      />

      <main className={styles.content}>
        {/* Metas Nutricionais */}
        <Card className={`${styles.section} ${styles.goalsSection}`}>
          <h2 className={styles.goalsSectionTitle}>
            Metas Nutricionais Diárias
          </h2>
          <p className={styles.goalsDescription}>
            Defina as metas de macronutrientes que o paciente deve atingir diariamente.
          </p>

          <div className={styles.goalsGrid}>
            <div className={styles.goalField}>
              <label>Proteínas (g)</label>
              <Input
                type="number"
                value={macroGoals.protein_goal ?? ''}
                onChange={(e) => updateMacroGoal('protein_goal', e.target.value)}
                placeholder="Ex: 150"
              />
            </div>

            <div className={styles.goalField}>
              <label>Carboidratos (g)</label>
              <Input
                type="number"
                value={macroGoals.carbs_goal ?? ''}
                onChange={(e) => updateMacroGoal('carbs_goal', e.target.value)}
                placeholder="Ex: 200"
              />
            </div>

            <div className={styles.goalField}>
              <label>Gorduras (g)</label>
              <Input
                type="number"
                value={macroGoals.fats_goal ?? ''}
                onChange={(e) => updateMacroGoal('fats_goal', e.target.value)}
                placeholder="Ex: 60"
              />
            </div>

            <div className={styles.goalField}>
              <label>
                Calorias (kcal) <span className={styles.optionalLabel}>(auto: P×4 + C×4 + G×9)</span>
              </label>
              <Input
                type="number"
                value={macroGoals.calories_goal ?? ''}
                readOnly
                tabIndex={-1}
                placeholder="Calculado automaticamente"
              />
            </div>

            <div className={styles.goalField}>
              <label>
                Fibras (g) <span className={styles.optionalLabel}>(opcional)</span>
              </label>
              <Input
                type="number"
                value={macroGoals.fiber_goal ?? ''}
                onChange={(e) => updateMacroGoal('fiber_goal', e.target.value)}
                placeholder="Ex: 25"
              />
            </div>
          </div>
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Dados básicos</h2>
          <p className={styles.profileSummary}>
            Nome, nascimento, peso e altura ficam no perfil do aluno
            {client?.birth_date && ` · Nasc.: ${client.birth_date.split('-').reverse().join('/')}`}
            {client?.current_weight_kg && ` · ${client.current_weight_kg} kg`}
            {client?.height_cm && ` · ${client.height_cm} cm`}
          </p>
          {textInput('profession', 'Profissão')}
          {textInput('instagram', 'Instagram', '@usuario')}
          {textInput('referral_source', 'Como conheceu meu trabalho?')}
          {singleChoice('main_goal', 'Objetivo principal', MAIN_GOAL_OPTIONS)}
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Objetivo e dor</h2>
          {textArea('body_change_wish', 'O que você mais gostaria de mudar no seu corpo hoje?')}
          {textArea('body_part_bothers', 'Qual parte do seu corpo mais te incomoda atualmente?')}
          {textArea(
            'ideal_result',
            'Se daqui a 4–6 meses você tivesse o resultado ideal, como gostaria de estar? Qual seria sua ideia de físico ideal?',
            3
          )}
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Histórico</h2>
          {multiChoice('tried_before', 'O que você já tentou?', TRIED_BEFORE_OPTIONS)}
          {textArea('best_result', 'Qual foi o melhor resultado que você já conseguiu?')}
          {yesNo('kept_result', 'Conseguiu manter esse resultado?')}
          {textArea('lost_result_reason', 'O que aconteceu para você perder esse resultado ou parar?')}
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Alimentação</h2>

          <div className={styles.field}>
            <label>Quantas refeições você costuma fazer por dia?</label>
            <Input
              type="number"
              value={anamnesis.meals_per_day || ''}
              onChange={(e) => updateField('meals_per_day', Number(e.target.value))}
            />
          </div>

          {textArea('meals_description', 'Qual a composição e o horário das refeições?', 4)}
          {textArea('food_difficulty', 'Qual é hoje sua maior dificuldade com alimentação?')}
          {multiChoice('hunger_times', 'Em qual momento do dia você sente mais fome?', HUNGER_TIME_OPTIONS)}
          {textArea('preferred_foods', 'O que mais gosta de comer?', 3)}
          {textArea('disliked_foods', 'Quais alimentos não gosta?', 3)}
          {textInput('cravings_time', 'Qual horário sente mais vontade de comer doce ou salgado?')}

          <div className={styles.field}>
            <label>Quantos litros de água consome por dia?</label>
            <Input
              type="number"
              step="0.5"
              value={anamnesis.water_liters_per_day || ''}
              onChange={(e) => updateField('water_liters_per_day', Number(e.target.value))}
            />
          </div>

          {textInput('alcohol_consumption', 'Consome bebida alcoólica? Com que frequência?')}
          {textArea('weekend_meals', 'O que come nos finais de semana? Refeição fora da dieta?')}
          {textArea('supplements', 'Utiliza suplementação? Quais?')}

          <div className={styles.field}>
            <label>Idas ao banheiro (frequência de evacuação):</label>
            <select
              className={styles.select}
              value={anamnesis.bowel_frequency || ''}
              onChange={(e) => updateField('bowel_frequency', e.target.value as any)}
            >
              <option value="">Selecione</option>
              <option value="once_a_day">1x ao dia</option>
              <option value="every_other_day">Dia sim, dia não</option>
              <option value="constipated">Constipado</option>
              <option value="more_than_once">Mais de 1x ao dia</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>Como está sua digestão?</label>
            <select
              className={styles.select}
              value={anamnesis.digestion || ''}
              onChange={(e) => updateField('digestion', e.target.value as any)}
            >
              <option value="">Selecione</option>
              <option value="good">Boa</option>
              <option value="poor">Ruim</option>
              <option value="terrible">Péssima</option>
            </select>
          </div>
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Rotina</h2>
          {singleChoice('work_activity', 'Como é sua rotina de trabalho?', WORK_ACTIVITY_OPTIONS)}
          {textInput('work_hours', 'Horário de trabalho', 'Ex: 8h às 18h')}
          {singleChoice('mental_load', 'Seu trabalho exige muito mentalmente?', MENTAL_LOAD_OPTIONS)}
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Treino</h2>
          {yesNo('trains_currently', 'Você treina atualmente?')}
          {textInput('training_frequency', 'Quantas vezes por semana?')}
          {textInput('current_exercise_type', 'Qual tipo de exercício pratica atualmente?')}
          {textInput('exercise_duration', 'Há quanto tempo você treina com regularidade?')}
          {textArea('body_part_to_develop', 'Qual parte do corpo você gostaria de desenvolver mais?')}
          {textArea('training_limitations', 'Existe alguma dor ou limitação para treinar?')}
          {textInput('routine_exercises', 'Pratica alguma outra atividade física? (passeio, caminhada...)')}

          <div className={styles.field}>
            <label>Rotina de atividade física semanal:</label>
            <div className={styles.weeklyGrid}>
              {DAYS.map((day) => (
                <div key={day} className={styles.dayField}>
                  <span className={styles.dayLabel}>{day}</span>
                  <Input
                    value={(anamnesis.weekly_routine as Record<string, string>)?.[day] || ''}
                    onChange={(e) => updateWeeklyRoutine(day, e.target.value)}
                    placeholder="Ex: Treino A"
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Sono, energia e estresse</h2>

          <div className={styles.field}>
            <label>Quantas horas costuma dormir?</label>
            <Input
              type="number"
              value={anamnesis.sleep_hours ?? ''}
              onChange={(e) => updateField('sleep_hours', e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Horário que dorme:</label>
              <Input
                type="time"
                value={anamnesis.bedtime || ''}
                onChange={(e) => updateField('bedtime', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Horário que acorda:</label>
              <Input
                type="time"
                value={anamnesis.wakeup_time || ''}
                onChange={(e) => updateField('wakeup_time', e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Como avalia seu sono?</label>
            <select
              className={styles.select}
              value={anamnesis.sleep_quality || ''}
              onChange={(e) => updateField('sleep_quality', e.target.value as any)}
            >
              <option value="">Selecione</option>
              <option value="excellent">Excelente</option>
              <option value="good">Bom</option>
              <option value="regular">Médio</option>
              <option value="poor">Ruim</option>
              <option value="terrible">Péssimo</option>
            </select>
          </div>

          {textArea('energy_level', 'Como fica sua energia durante o dia?')}
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Saúde</h2>

          {textArea('diseases', 'Tem alguma doença crônica?')}
          {textArea('family_history', 'Histórico de doença na família?')}
          {yesNo('smoker', 'Você fuma?')}
          {textArea('medications', 'Usa algum medicamento atualmente? Qual?')}
          {textArea('food_allergies', 'Possui alguma alergia ou intolerância alimentar relevante? Qual?')}

          <div className={styles.field}>
            <label>Como classifica sua saúde?</label>
            <select
              className={styles.select}
              value={anamnesis.health_rating || ''}
              onChange={(e) => updateField('health_rating', e.target.value as any)}
            >
              <option value="">Selecione</option>
              <option value="excellent">Excelente</option>
              <option value="good">Boa</option>
              <option value="regular">Regular</option>
              <option value="poor">Ruim</option>
            </select>
          </div>
        </Card>

        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>Fechamento da call</h2>
          <p className={styles.callScript}>
            “Então, pelo que você me contou, não parece ser falta de esforço. Você já [treina / tentou
            dieta / já conseguiu emagrecer etc.]. O que está acontecendo principalmente é [repita os 2–3
            problemas que ELE falou]. Faz sentido?”
          </p>
        </Card>

        <Button fullWidth onClick={handleSave} loading={saving}>
          <Save size={18} />
          Salvar Anamnese
        </Button>
      </main>
    </PageContainer>
  );
}

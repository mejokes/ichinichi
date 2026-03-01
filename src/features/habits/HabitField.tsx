import { useCallback, useState } from "react";
import type { HabitDefinition } from "../../types";
import styles from "./HabitTracker.module.css";

interface HabitFieldProps {
  definition: HabitDefinition;
  value: string;
  onChange: (value: string) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  isEditable: boolean;
}

export function HabitField({
  definition,
  value,
  onChange,
  onRename,
  onRemove,
  isEditable,
}: HabitFieldProps) {
  const { name } = definition;
  const completed = value !== "";
  const [editingName, setEditingName] = useState(name);

  const handleCheckboxToggle = () => {
    if (!isEditable) return;
    onChange(completed ? "" : "done");
  };

  const handleNameBlur = () => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else if (!trimmed) {
      if (window.confirm("Remove habit?")) {
        onRemove();
      } else {
        setEditingName(name);
      }
    } else {
      setEditingName(name);
    }
  };

  const scrollIntoView = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Small delay to let virtual keyboard appear on mobile
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
  }, []);

  return (
    <div className={styles.field}>
      <input
        type="checkbox"
        checked={completed}
        onChange={handleCheckboxToggle}
        disabled={!isEditable}
        className={styles.checkbox}
        aria-label={`${name} completed`}
      />
      <div className={styles.fieldBody}>
        {isEditable ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleNameBlur}
            onFocus={scrollIntoView}
            className={styles.nameInput}
          />
        ) : (
          <span className={styles.fieldName}>{name}</span>
        )}
        {isEditable ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isEditable}
            className={styles.input}
            placeholder="..."
            onFocus={scrollIntoView}
          />
        ) : (
          value !== "" && <span className={styles.valueText}>{value}</span>
        )}
      </div>
    </div>
  );
}

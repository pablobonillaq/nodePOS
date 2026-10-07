import React, { useEffect, useState } from 'react';
import { AppModal } from './AppModal';
import { Button } from './Button';
import { TextField } from './TextField';

interface Props {
  visible: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger';
  /** Exigir texto para confirmar */
  required?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

/** Modal con un campo de texto (sustituye a Alert.prompt, que no existe en Android). */
export function PromptModal({
  visible,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmText = 'Guardar',
  confirmVariant = 'primary',
  required,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button title="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            title={confirmText}
            variant={confirmVariant}
            loading={loading}
            disabled={required && !value.trim()}
            onPress={() => onSubmit(value.trim())}
          />
        </>
      }>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={setValue}
        autoFocus
        multiline
      />
    </AppModal>
  );
}

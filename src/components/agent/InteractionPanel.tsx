'use client';

import { Interaction } from '@/types/interaction';
import { SingleChoice } from '@/components/interactions/SingleChoice';
import { YesNo } from '@/components/interactions/YesNo';
import { FileUpload } from '@/components/interactions/FileUpload';
import { Confirm } from '@/components/interactions/Confirm';
import { TextInput } from '@/components/interactions/TextInput';

interface InteractionPanelProps {
  interaction: Interaction;
  onSubmit: (stepId: string, value: unknown) => void;
  disabled?: boolean;
}

export function InteractionPanel({ interaction, onSubmit, disabled }: InteractionPanelProps) {
  const handleSubmit = (value: unknown) => {
    onSubmit(interaction.stepId, value);
  };

  switch (interaction.type) {
    case 'single_choice':
      return (
        <SingleChoice
          question={interaction.question}
          options={interaction.options}
          onSubmit={(v) => handleSubmit(v)}
          disabled={disabled}
        />
      );
    case 'yes_no':
      return (
        <YesNo
          question={interaction.question}
          onSubmit={(v) => handleSubmit(v)}
          disabled={disabled}
        />
      );
    case 'file_upload':
      return (
        <FileUpload
          question={interaction.question}
          accept={interaction.accept}
          onSubmit={(v) => handleSubmit(v)}
          disabled={disabled}
        />
      );
    case 'confirm':
      return (
        <Confirm
          question={interaction.question}
          detail={interaction.detail}
          onSubmit={(v) => handleSubmit(v)}
          disabled={disabled}
        />
      );
    case 'text_input':
      return (
        <TextInput
          question={interaction.question}
          placeholder={interaction.placeholder}
          onSubmit={(v) => handleSubmit(v)}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}

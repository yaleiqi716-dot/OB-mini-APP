export type InteractionType = 'single_choice' | 'yes_no' | 'file_upload' | 'confirm' | 'text_input';

export interface BaseInteraction {
  id: string;
  taskId: string;
  stepId: string;
  type: InteractionType;
  question: string;
}

export interface SingleChoiceInteraction extends BaseInteraction {
  type: 'single_choice';
  options: { label: string; value: string }[];
}

export interface YesNoInteraction extends BaseInteraction {
  type: 'yes_no';
}

export interface FileUploadInteraction extends BaseInteraction {
  type: 'file_upload';
  accept?: string;
  maxSizeMB?: number;
}

export interface ConfirmInteraction extends BaseInteraction {
  type: 'confirm';
  detail: string;
}

export interface TextInputInteraction extends BaseInteraction {
  type: 'text_input';
  placeholder?: string;
}

export type Interaction =
  | SingleChoiceInteraction
  | YesNoInteraction
  | FileUploadInteraction
  | ConfirmInteraction
  | TextInputInteraction;

export interface InteractionResponse {
  interactionId: string;
  stepId: string;
  value: unknown;
}

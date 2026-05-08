import { useCallback, useState } from 'react';

export interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  isAlert: boolean;
  onConfirm: () => void;
}

const CLOSED_MODAL: ModalConfig = {
  isOpen: false,
  title: '',
  message: '',
  isAlert: false,
  onConfirm: () => {},
};

export const useModalState = () => {
  const [modalConfig, setModalConfig] = useState<ModalConfig>(CLOSED_MODAL);

  const closeModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const openConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isAlert: false,
      onConfirm: () => {
        onConfirm();
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, []);

  const openAlert = useCallback((title: string, message: string) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isAlert: true,
      onConfirm: () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, []);

  return {
    modalConfig,
    openAlert,
    openConfirm,
    closeModal,
  };
};

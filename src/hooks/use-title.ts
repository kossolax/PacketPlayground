import { useOutletContext } from 'react-router-dom';

export type LayoutContextType = {
  title: string;
  setTitle: (title: string) => void;
};

export function usePageTitle() {
  return useOutletContext<LayoutContextType>();
}

import type { ButtonHTMLAttributes } from 'react';
import './PrimaryButton.css';

export default function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`primary-button ${className ?? ''}`.trim()} {...props} />;
}

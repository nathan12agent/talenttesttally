interface ErrorMessageProps {
  message: string | null | undefined;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-red-600 text-sm mt-1" role="alert">
      {message}
    </p>
  );
}

interface Props {
  title: string;
  detail?: string;
}

// Full-screen, theme-independent message for states without a screen to show.
export const StatusMessage = ({ title, detail }: Props) => (
  <div className="status-message" role="status">
    <p className="status-message__title">{title}</p>
    {detail ? <p className="status-message__detail">{detail}</p> : null}
  </div>
);

interface Props {
  title: string;
  detail?: string;
  // A large code, such as the display id, readable from across the room.
  code?: string;
}

// Full-screen, theme-independent message for states without a screen to show.
export const StatusMessage = ({ title, detail, code }: Props) => (
  <div className="status-message" role="status">
    <p className="status-message__title">{title}</p>
    {code ? <p className="status-message__code">{code}</p> : null}
    {detail ? <p className="status-message__detail">{detail}</p> : null}
  </div>
);

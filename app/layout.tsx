import './globals.css';

export const metadata = {
  title: 'FoxESS × RCE — Dashboard',
  description: 'Przychody z net-billingu (FoxESS + RCE/RCEm)'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}

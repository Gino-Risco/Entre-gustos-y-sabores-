import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-white">404</h1>
        <p className="text-slate-400">Página no encontrada</p>
        <Button onClick={() => navigate('/dashboard')} className="bg-primary">
          Volver al Dashboard
        </Button>
      </div>
    </div>
  );
};
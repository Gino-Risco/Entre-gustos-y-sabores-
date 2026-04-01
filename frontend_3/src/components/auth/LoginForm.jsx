import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChefHat, User, Lock, Eye, EyeOff, ClipboardList, UtensilsCrossed, Users } from 'lucide-react';
import { toast } from 'sonner';
import fondoRestaurante from '@/assets/fonde.jpg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

export const LoginForm = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ usuario: '', password: '' });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.usuario || formData.usuario.length < 3) {
      newErrors.usuario = 'El usuario debe tener al menos 3 caracteres';
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const response = await authService.login(formData);
      login(response.user, response.token, response.token);
      toast.success(`¡Bienvenido, ${response.user.nombre}!`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  return (
    <div className="min-h-screen w-full bg-[#0F172A] flex items-center justify-center p-4 lg:p-0 overflow-hidden relative">

      {/* Fondo decorativo */}
    <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-850 via-slate-900/90 to-slate-950 z-10" />
        <img 
          src={fondoRestaurante} 
          className="w-full h-full object-cover opacity-20 blur-[2px]"
          alt="background"
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-4">

        {/* LADO IZQUIERDO: Branding e Info */}
        <div className="hidden lg:flex flex-col space-y-10 justify-center pr-12">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-cyan-500 flex items-center justify-center shadow-xl shadow-cyan-500/20">              <ChefHat className="h-10 w-10 text-slate-950" />
            </div>
            <div>
              <h1 className="text-white text-4xl font-extrabold leading-tight">
                Entre gustos <br /> <span className="text-cyan-500">y sabores</span>
              </h1>
              <p className="text-slate-500 text-xs tracking-[3px] uppercase font-bold mt-1">v1.0.0</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-5xl font-bold text-white leading-tight">Sistema de Punto de Venta</h2>
            <p className="text-slate-400 text-lg max-w-md">
              Gestiona tu restaurante de manera eficiente con nuestro sistema integral. Control de pedidos, ventas e inventario.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                <ClipboardList className="h-5 w-5" />
              </div>
              <span className="text-slate-300 font-medium text-sm">Gestión de Pedidos</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <span className="text-slate-300 font-medium text-sm">Gestión de Productos e insumos</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-slate-300 font-medium text-sm">Múltiples Usuarios</span>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: Formulario */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-8 lg:p-10 rounded-[2.5rem] shadow-2xl">
            <div className="mb-10">
              <h3 className="text-3xl font-bold text-white mb-2">Iniciar Sesión</h3>
              <p className="text-slate-400">Ingresa tus credenciales para acceder</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-slate-300 ml-1">Usuario</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <Input
                    id="usuario"
                    name="usuario"
                    type="text"
                    placeholder="Ingresa tu usuario"
                    className="bg-slate-950/50 border-slate-800 text-white pl-10 h-12 rounded-xl focus:ring-orange-500"
                    value={formData.usuario}
                    onChange={handleChange}
                  />
                </div>
                {errors.usuario && <p className="text-xs text-red-400 ml-1">{errors.usuario}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="bg-slate-950/50 border-slate-800 text-white pl-10 pr-10 h-12 rounded-xl focus:ring-orange-500"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 ml-1">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Ingresar al Sistema'
                )}
              </Button>

              <div className="text-center pt-4 border-t border-slate-800/50">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest">
                  © 2026 Entre gustos y sabores
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
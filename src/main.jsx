import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/600.css';
import '@fontsource/lexend/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  DatabaseBackup,
  Download,
  Edit3,
  Eye,
  Filter,
  FolderOpen,
  HelpCircle,
  Info,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  Upload,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import './styles.css';
import { EMPTY_DATA, isTauriRuntime, loadAppData, saveAppData } from './storage';

const NAV_ITEMS = [
  { id: 'consult', label: 'Consultar precios', icon: Search },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'special', label: 'Precios especiales', icon: BadgeDollarSign },
  { id: 'backup', label: 'Copias de seguridad', icon: DatabaseBackup },
];

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function money(value) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function parseCsvLine(line) {
  const result = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      result.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  result.push(value.trim());
  return result;
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv(data) {
  const lines = ['# TABLE: products', 'code,cost,price,stock'];
  data.products.forEach((product) => {
    lines.push([product.code, product.cost, product.price, product.stock].map(csvValue).join(','));
  });
  lines.push('', '# TABLE: clients', 'id,name');
  data.clients.forEach((client) => lines.push([client.id, client.name].map(csvValue).join(',')));
  lines.push('', '# TABLE: special_prices', 'client_name,product_code,price');
  data.specialPrices.forEach((special) => {
    lines.push([special.clientName, special.productCode, special.price].map(csvValue).join(','));
  });
  return `${lines.join('\n')}\n`;
}

function importCsv(text) {
  const imported = { ...EMPTY_DATA, products: [], clients: [], specialPrices: [] };
  let section = '';
  let header = true;
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      section = '';
      header = true;
      return;
    }
    if (trimmed.startsWith('# TABLE:')) {
      section = trimmed.replace('# TABLE:', '').trim();
      header = true;
      return;
    }
    if (header) {
      header = false;
      return;
    }
    const values = parseCsvLine(line);
    if (section === 'products' && values.length >= 4) {
      const code = normalize(values[0]);
      const cost = Number(values[1]);
      const price = Number(values[2]);
      const stock = Number(values[3]);
      if (code && Number.isFinite(cost) && Number.isFinite(price) && Number.isFinite(stock)) {
        imported.products.push({ code, cost, price, stock: Math.max(0, Math.trunc(stock)) });
      }
    }
    if (section === 'clients' && values.length >= 1) {
      const name = normalize(values[values.length > 1 ? 1 : 0]);
      const id = values.length > 1 ? values[0] : '';
      if (name) imported.clients.push({ id: id || crypto.randomUUID(), name });
    }
    if (section === 'special_prices' && values.length >= 3) {
      const clientName = normalize(values[0]);
      const productCode = normalize(values[1]);
      const price = Number(values[2]);
      if (clientName && productCode && Number.isFinite(price)) {
        imported.specialPrices.push({ clientName, productCode, price });
      }
    }
  });
  return imported;
}

function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [page, setPage] = useState('consult');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    loadAppData()
      .then((storedData) => {
        if (active) {
          setData(storedData);
          setHydrated(true);
        }
      })
      .catch((error) => {
        console.error('No se pudieron cargar los datos locales.', error);
        if (active) setHydrated(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveAppData(data).catch(() => notify('No se pudo guardar SQLite. Se conservó una copia local.', 'error'));
  }, [data, hydrated]);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(window.__filtrosToastTimer);
    window.__filtrosToastTimer = window.setTimeout(() => setToast(null), 3800);
  };

  const changePage = (nextPage) => {
    setPage(nextPage);
    setMobileOpen(false);
  };

  const updateProduct = (product) => {
    const code = normalize(product.code);
    if (!code) return notify('Escribe un código de producto.', 'error');
    const cost = Number(product.cost);
    const price = Number(product.price);
    const stock = Number(product.stock);
    if (![cost, price, stock].every(Number.isFinite) || cost < 0 || price < 0 || stock < 0) {
      return notify('Revisa costo, precio y stock. No pueden ser negativos.', 'error');
    }
    setData((current) => {
      const exists = current.products.some((item) => item.code === code);
      const nextProduct = { code, cost, price, stock: Math.trunc(stock) };
      return {
        ...current,
        products: exists
          ? current.products.map((item) => (item.code === code ? nextProduct : item))
          : [...current.products, nextProduct].sort((a, b) => a.code.localeCompare(b.code)),
      };
    });
    notify(`Producto ${code} guardado correctamente.`);
    return true;
  };

  const saveClient = (client) => {
    const name = normalize(client.name);
    if (!name) return notify('Escribe el nombre del cliente.', 'error');
    if (data.clients.some((item) => item.name === name)) return notify('Ese cliente ya existe.', 'error');
    setData((current) => ({
      ...current,
      clients: [...current.clients, { id: client.id.trim() || crypto.randomUUID(), name }].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    notify(`Cliente ${name} registrado correctamente.`);
    return true;
  };

  const saveSpecialPrice = (special) => {
    const clientName = normalize(special.clientName);
    const productCode = normalize(special.productCode);
    const price = Number(special.price);
    if (!clientName || !productCode || !Number.isFinite(price) || price < 0) {
      return notify('Completa cliente, producto y precio especial.', 'error');
    }
    if (!data.clients.some((client) => client.name === clientName)) return notify('El cliente no existe.', 'error');
    if (!data.products.some((product) => product.code === productCode)) return notify('El producto no existe.', 'error');
    setData((current) => {
      const next = { clientName, productCode, price };
      const exists = current.specialPrices.some((item) => item.clientName === clientName && item.productCode === productCode);
      return {
        ...current,
        specialPrices: exists
          ? current.specialPrices.map((item) => item.clientName === clientName && item.productCode === productCode ? next : item)
          : [...current.specialPrices, next].sort((a, b) => a.clientName.localeCompare(b.clientName)),
      };
    });
    notify('Precio especial asignado correctamente.');
    return true;
  };

  const deleteSpecialPrice = (special) => {
    setData((current) => ({
      ...current,
      specialPrices: current.specialPrices.filter((item) => !(item.clientName === special.clientName && item.productCode === special.productCode)),
    }));
    notify('Precio especial eliminado.');
  };

  const consultProduct = (clientName, productCode) => {
    const code = normalize(productCode);
    const client = normalize(clientName);
    const product = data.products.find((item) => item.code === code);
    if (!product) return null;
    const special = data.specialPrices.find((item) => item.clientName === client && item.productCode === code);
    return { product, appliedPrice: special?.price ?? product.price, hasSpecial: Boolean(special) };
  };

  const registerSale = (code) => {
    setData((current) => ({
      ...current,
      products: current.products.map((product) => product.code === code ? { ...product, stock: Math.max(0, product.stock - 1) } : product),
    }));
    notify('Venta registrada. El stock fue actualizado.');
  };

  const importData = (imported) => {
    const productMap = new Map(data.products.map((item) => [item.code, item]));
    imported.products.forEach((item) => productMap.set(item.code, item));
    const clientMap = new Map(data.clients.map((item) => [item.name, item]));
    imported.clients.forEach((item) => clientMap.set(item.name, item));
    const specialMap = new Map(data.specialPrices.map((item) => [`${item.clientName}::${item.productCode}`, item]));
    imported.specialPrices.forEach((item) => specialMap.set(`${item.clientName}::${item.productCode}`, item));
    setData({
      products: [...productMap.values()].sort((a, b) => a.code.localeCompare(b.code)),
      clients: [...clientMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      specialPrices: [...specialMap.values()].sort((a, b) => a.clientName.localeCompare(b.clientName)),
    });
    notify(`Importación completada: ${imported.products.length} productos, ${imported.clients.length} clientes y ${imported.specialPrices.length} precios especiales.`);
  };

  const clearLocalData = () => {
    if (!window.confirm('Se eliminarán los datos locales de v2.0. ¿Continuar?')) return;
    setData(EMPTY_DATA);
    notify('Datos locales eliminados.');
  };

  if (!hydrated) {
    return <div className="loading-screen"><div className="loading-mark">F</div><strong>Preparando Filtros Express PRO</strong><span>Abriendo el almacenamiento local…</span></div>;
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activePage={page}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={changePage}
        onToggle={() => setCollapsed((value) => !value)}
        onNewFilter={() => changePage('consult')}
        onCloseMobile={() => setMobileOpen(false)}
        onNotify={notify}
      />
      <main className="main-canvas">
        <header className="mobile-header">
          <button className="icon-button" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}><Menu size={24} /></button>
          <strong>Filtros Express PRO</strong>
          <button className="icon-button" aria-label="Ayuda" title="Ayuda" onClick={() => notify('Sistema local de gestión de filtros.') }><HelpCircle size={22} /></button>
        </header>
        <div className="content-canvas">
          {page === 'consult' && <ConsultPage data={data} onSearch={consultProduct} onSale={registerSale} onNotify={notify} />}
          {page === 'inventory' && <InventoryPage data={data} onSave={updateProduct} onNotify={notify} />}
          {page === 'clients' && <ClientsPage data={data} onSave={saveClient} />}
          {page === 'special' && <SpecialPricesPage data={data} onSave={saveSpecialPrice} onDelete={deleteSpecialPrice} />}
          {page === 'backup' && <BackupPage data={data} onImport={importData} onClear={clearLocalData} onNotify={notify} />}
          {page === 'settings' && <SettingsPage data={data} onClear={clearLocalData} />}
        </div>
      </main>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function Sidebar({ activePage, collapsed, mobileOpen, onNavigate, onToggle, onNewFilter, onCloseMobile, onNotify }) {
  return (
    <>
      {mobileOpen && <button className="mobile-scrim" aria-label="Cerrar menú" onClick={onCloseMobile} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-visible' : ''}`}>
        <div className="sidebar-topline">
          <div className="brand-block">
            <span className="brand-mark">F</span>
            <div className="brand-copy"><strong>Filtros Express</strong><span>PRO · v2.0</span></div>
          </div>
          <button className="collapse-button" aria-label={collapsed ? 'Expandir barra lateral' : 'Comprimir barra lateral'} title={collapsed ? 'Expandir barra lateral' : 'Comprimir barra lateral'} onClick={onToggle}>
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
        <div className="profile-snippet">
          <span className="avatar">A</span>
          <div className="profile-copy"><strong>Administrador</strong><span>Sesión activa</span></div>
        </div>
        <button className="new-filter-button" onClick={onNewFilter}><Plus size={19} /><span>Nuevo filtro</span></button>
        <nav className="side-nav" aria-label="Navegación principal">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activePage === id ? 'active' : ''}`} onClick={() => onNavigate(id)} title={collapsed ? label : undefined}>
              <Icon size={20} strokeWidth={activePage === id ? 2.4 : 2} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => onNavigate('settings')} title={collapsed ? 'Ajustes' : undefined}><Settings size={20} /><span>Ajustes</span></button>
          <button className="nav-item danger" onClick={() => onNotify('La sesión local permanece activa mientras la aplicación está abierta.')} title={collapsed ? 'Cerrar sesión' : undefined}><LogOut size={20} /><span>Cerrar sesión</span></button>
        </div>
        <div className="sidebar-version">v2.0 · local</div>
      </aside>
    </>
  );
}

function PageHeader({ title, description, action }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Card({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function TextInput({ id, label, value, onChange, placeholder, type = 'text', min, step, icon: Icon, list, autoComplete = 'off' }) {
  return <div className="field"><label htmlFor={id}>{label}</label><div className="input-wrap">{Icon && <Icon className="input-icon" size={19} />}<input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} min={min} step={step} list={list} autoComplete={autoComplete} /></div></div>;
}

function PrimaryButton({ children, onClick, type = 'button', disabled = false, icon: Icon }) {
  return <button className="primary-button" type={type} onClick={onClick} disabled={disabled}>{Icon && <Icon size={18} />}{children}</button>;
}

function SecondaryButton({ children, onClick, icon: Icon, disabled = false }) {
  return <button className="secondary-button" type="button" onClick={onClick} disabled={disabled}>{Icon && <Icon size={18} />}{children}</button>;
}

function ConsultPage({ data, onSearch, onSale, onNotify }) {
  const [client, setClient] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);

  const search = () => {
    if (!code.trim()) return onNotify('Escribe el código del filtro para consultar.', 'error');
    const found = onSearch(client, code);
    setResult(found);
    if (!found) onNotify('No encontramos ese producto en el inventario.', 'error');
  };

  return <>
    <PageHeader title="Consultar precios" description="Consulta el precio de lista, tarifas especiales y stock disponible." action={<span className="status-chip"><span className="status-dot" /> Sistema local</span>} />
    <div className="consult-grid">
      <Card className="search-card">
        <div className="card-heading"><div className="heading-icon light-blue"><Search size={21} /></div><div><h2>Buscar precio</h2><p>Indica el cliente y el código del filtro.</p></div></div>
        <div className="form-grid two-columns">
          <TextInput id="consult-client" label="Cliente (opcional)" value={client} onChange={setClient} placeholder="Nombre del cliente" icon={Users} list="client-options" />
          <TextInput id="consult-code" label="Código del producto" value={code} onChange={setCode} placeholder="Ej. FLT-AF-1001" icon={Package} list="product-options" />
        </div>
        <div className="form-actions"><SecondaryButton onClick={() => { setClient(''); setCode(''); setResult(null); }} icon={X}>Limpiar</SecondaryButton><PrimaryButton onClick={search} icon={Search}>Consultar precio</PrimaryButton></div>
        <datalist id="client-options">{data.clients.map((clientItem) => <option key={clientItem.id} value={clientItem.name} />)}</datalist>
        <datalist id="product-options">{data.products.map((product) => <option key={product.code} value={product.code} />)}</datalist>
      </Card>
      <div className="quick-search-panel"><div className="quick-search-icon"><CircleDollarSign size={28} /></div><h2>Consulta rápida</h2><p>El precio especial se aplica automáticamente cuando existe una tarifa para el cliente seleccionado.</p><div className="quick-stat"><span>Productos registrados</span><strong>{data.products.length}</strong></div></div>
    </div>
    <Card className="result-card">
      <div className="result-header"><div><h2>Resultado de consulta</h2><p>{result ? `Información actual de ${result.product.code}` : 'Aquí aparecerán el precio y el stock del filtro.'}</p></div>{result && <span className={`stock-badge ${result.product.stock <= 10 ? 'low' : ''}`}>{result.product.stock} uds. disponibles</span>}</div>
      {result ? <div className="result-content">
        <div className="price-highlight"><span>Precio aplicado</span><strong>{money(result.appliedPrice)}</strong><small>{result.hasSpecial ? 'Tarifa especial para este cliente' : 'Precio de lista'}</small></div>
        <div className="result-detail"><span>Producto</span><strong>{result.product.code}</strong></div>
        <div className="result-detail"><span>Precio de lista</span><strong>{money(result.product.price)}</strong></div>
        <div className="result-detail"><span>Costo de compra</span><strong>{money(result.product.cost)}</strong></div>
        <div className="result-actions"><PrimaryButton onClick={() => { if (result.product.stock <= 0) return onNotify('No hay stock disponible para registrar la venta.', 'error'); onSale(result.product.code); setResult(onSearch(client, result.product.code)); }} icon={ShoppingCart}>Registrar venta</PrimaryButton></div>
      </div> : <div className="empty-state compact"><div className="empty-icon"><Search size={25} /></div><strong>Sin consulta todavía</strong><span>Completa el código del producto y pulsa “Consultar precio”.</span></div>}
    </Card>
  </>;
}

function InventoryPage({ data, onSave, onNotify }) {
  const [form, setForm] = useState({ code: '', cost: '', price: '', stock: '' });
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const visible = data.products.filter((item) => item.code.includes(normalize(filter)));
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = () => { const saved = onSave(form); if (saved) { setForm({ code: '', cost: '', price: '', stock: '' }); setEditing(false); } };
  const edit = (product) => { setForm({ code: product.code, cost: String(product.cost), price: String(product.price), stock: String(product.stock) }); setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <>
    <PageHeader title="Gestión de Inventario" description="Crea, actualiza y revisa el stock de productos." action={<SecondaryButton onClick={() => document.getElementById('inventory-table')?.scrollIntoView({ behavior: 'smooth' })} icon={Eye}>Ver inventario completo</SecondaryButton>} />
    <div className="inventory-grid">
      <Card className="form-card">
        <div className="card-heading bordered"><div className="heading-icon navy"><Package size={21} /></div><div><h2>{editing ? 'Actualizar producto' : 'Registrar producto'}</h2><p>Completa los datos visibles del filtro.</p></div></div>
        <div className="form-stack">
          <TextInput id="product-code" label="Código de producto" value={form.code} onChange={(value) => setField('code', value)} placeholder="Ej. FLT-AF-1001" icon={Package} />
          <TextInput id="product-cost" label="Costo de compra (S/)" value={form.cost} onChange={(value) => setField('cost', value)} placeholder="0.00" type="number" min="0" step="0.01" icon={CircleDollarSign} />
          <TextInput id="product-price" label="Precio de venta (S/)" value={form.price} onChange={(value) => setField('price', value)} placeholder="0.00" type="number" min="0" step="0.01" icon={BadgeDollarSign} />
          <TextInput id="product-stock" label="Stock actual (unidades)" value={form.stock} onChange={(value) => setField('stock', value)} placeholder="0" type="number" min="0" step="1" icon={Package} />
        </div>
        <div className="form-actions full-width"><SecondaryButton onClick={() => { setForm({ code: '', cost: '', price: '', stock: '' }); setEditing(false); }} icon={X}>Cancelar</SecondaryButton><PrimaryButton onClick={submit} icon={Save}>{editing ? 'Guardar cambios' : 'Registrar producto'}</PrimaryButton></div>
      </Card>
      <Card className="table-card" id="inventory-table">
        <div className="table-toolbar"><div><h2>Vista previa de stock</h2><p>{visible.length} productos visibles</p></div><div className="toolbar-search"><Search size={18} /><input aria-label="Buscar código" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar código..." /></div></div>
        <ProductTable products={visible} onEdit={edit} />
        <div className="table-footer"><span>Mostrando {visible.length} de {data.products.length} productos</span><span className="table-note"><Info size={15} /> Edita desde la fila</span></div>
      </Card>
    </div>
  </>;
}

function ProductTable({ products, onEdit }) {
  if (!products.length) return <div className="empty-state table-empty"><div className="empty-icon"><Package size={26} /></div><strong>No hay productos registrados</strong><span>Registra tu primer filtro o importa la copia CSV de v1.3.</span></div>;
  return <div className="table-scroll"><table><thead><tr><th>Código</th><th className="align-right">Stock</th><th className="align-right">Costo</th><th className="align-right">Precio venta</th><th className="align-center">Acción</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.code} className={index % 2 ? 'zebra' : ''}><td className="code-cell">{product.code}</td><td className="align-right"><span className={`stock-pill ${product.stock <= 10 ? 'low' : ''}`}>{product.stock}</span></td><td className="align-right">{money(product.cost)}</td><td className="align-right price-cell">{money(product.price)}</td><td className="align-center"><button className="row-action icon-only" onClick={() => onEdit(product)} title={`Editar ${product.code}`} aria-label={`Editar ${product.code}`}><Edit3 size={18} /></button></td></tr>)}</tbody></table></div>;
}

function ClientsPage({ data, onSave }) {
  const [form, setForm] = useState({ id: '', name: '' });
  const [filter, setFilter] = useState('');
  const visible = data.clients.filter((client) => client.name.includes(normalize(filter)) || String(client.id).includes(filter));
  const submit = () => { if (onSave(form)) setForm({ id: '', name: '' }); };
  return <>
    <PageHeader title="Gestión de Clientes" description="Registra nuevos clientes o consulta el directorio existente." />
    <Card className="client-form-card">
      <div className="card-heading"><div className="heading-icon light-blue"><UserCircle size={21} /></div><div><h2>Registrar nuevo cliente</h2><p>Los datos se guardan solamente en este equipo.</p></div></div>
      <div className="form-grid two-columns"><TextInput id="client-id" label="Identificación (opcional)" value={form.id} onChange={(value) => setForm((current) => ({ ...current, id: value }))} placeholder="Ej. 1029384756" icon={Info} /><TextInput id="client-name" label="Nombre completo" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Ej. Juan Pérez" icon={Users} /></div>
      <div className="form-actions"><PrimaryButton onClick={submit} icon={Save}>Guardar cliente</PrimaryButton></div>
    </Card>
    <Card className="directory-card">
      <div className="table-toolbar"><div className="card-heading inline"><div className="heading-icon gray"><FolderOpen size={20} /></div><div><h2>Directorio de clientes</h2><p>{visible.length} clientes visibles</p></div></div><div className="toolbar-search"><Search size={18} /><input aria-label="Buscar cliente" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar cliente..." /></div></div>
      {visible.length ? <div className="table-scroll"><table><thead><tr><th>ID cliente</th><th>Nombre completo</th><th className="align-right">Estado</th></tr></thead><tbody>{visible.map((client, index) => <tr key={client.id} className={index % 2 ? 'zebra' : ''}><td>{client.id}</td><td className="name-cell">{client.name}</td><td className="align-right"><span className="active-pill">Activo</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon"><Users size={26} /></div><strong>No hay clientes registrados</strong><span>Utiliza el formulario superior para añadir el primer cliente al directorio.</span></div>}
      <div className="table-footer"><span>Mostrando {visible.length} de {data.clients.length} resultados</span><span className="table-note"><Filter size={15} /> Filtro activo</span></div>
    </Card>
  </>;
}

function SpecialPricesPage({ data, onSave, onDelete }) {
  const [form, setForm] = useState({ clientName: '', productCode: '', price: '' });
  const submit = () => { if (onSave(form)) setForm({ clientName: '', productCode: '', price: '' }); };
  return <>
    <PageHeader title="Asignación de precios especiales" description="Configura tarifas personalizadas para clientes específicos." />
    <Card className="special-card">
      <div className="card-heading"><div className="heading-icon light-blue"><BadgeDollarSign size={21} /></div><div><h2>Asignar precio especial</h2><p>Una tarifa especial reemplaza el precio de lista para esa combinación.</p></div></div>
      <div className="field"><label htmlFor="special-client">Cliente</label><div className="input-wrap"><Search className="input-icon" size={19} /><select id="special-client" value={form.clientName} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}><option value="">Selecciona un cliente</option>{data.clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}</select></div></div>
      <div className="form-grid two-columns"><TextInput id="special-product" label="Código de producto" value={form.productCode} onChange={(value) => setForm((current) => ({ ...current, productCode: value }))} placeholder="Ej. FLT-AF-1001" icon={Package} list="special-products" /><TextInput id="special-price" label="Precio especial asignado (S/)" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: value }))} placeholder="0.00" type="number" min="0" step="0.01" icon={CircleDollarSign} /></div>
      <datalist id="special-products">{data.products.map((product) => <option key={product.code} value={product.code} />)}</datalist>
      <div className="form-actions"><SecondaryButton onClick={() => setForm({ clientName: '', productCode: '', price: '' })} icon={X}>Cancelar</SecondaryButton><PrimaryButton onClick={submit} icon={Save}>Asignar precio especial</PrimaryButton></div>
    </Card>
    <Card className="special-list-card"><div className="table-toolbar"><div><h2>Tarifas asignadas</h2><p>Consulta y elimina reglas existentes.</p></div></div>{data.specialPrices.length ? <div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Producto</th><th className="align-right">Precio especial</th><th className="align-center">Acción</th></tr></thead><tbody>{data.specialPrices.map((special) => <tr key={`${special.clientName}-${special.productCode}`}><td>{special.clientName}</td><td className="code-cell">{special.productCode}</td><td className="align-right price-cell">{money(special.price)}</td><td className="align-center"><button className="row-action danger-action" onClick={() => onDelete(special)} title="Eliminar precio especial"><Trash2 size={17} /><span>Eliminar</span></button></td></tr>)}</tbody></table></div> : <div className="empty-state compact"><div className="empty-icon"><BadgeDollarSign size={24} /></div><strong>No hay tarifas especiales</strong><span>Asigna una tarifa cuando tengas clientes y productos registrados.</span></div>}</Card>
  </>;
}

function BackupPage({ data, onImport, onClear, onNotify }) {
  const fileRef = useRef(null);
  const nativeStorage = isTauriRuntime();
  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { onImport(importCsv(String(reader.result))); } catch { onNotify('No se pudo leer el archivo CSV.', 'error'); }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };
  return <>
    <PageHeader title="Gestión de datos" description="Exporta una copia o recupera la información de tu versión anterior." />
    <div className="notice warning"><AlertTriangle size={22} /><div><strong>Datos locales</strong><span>La información se guarda en este equipo. Exporta una copia antes de migrar o actualizar la aplicación.</span></div></div>
    <div className="backup-grid">
      <Card className="backup-card"><div className="backup-icon blue"><Download size={24} /></div><h2>Exportar copia</h2><p>Guarda productos, clientes y precios especiales en el formato CSV compatible con v1.3.</p><PrimaryButton onClick={() => { downloadFile(`filtros-express-backup-${new Date().toISOString().slice(0, 10)}.csv`, exportCsv(data)); onNotify('Copia CSV descargada correctamente.'); }} icon={Download}>Descargar CSV</PrimaryButton></Card>
      <Card className="backup-card"><div className="backup-icon navy"><Upload size={24} /></div><h2>Importar v1.3</h2><p>Selecciona el CSV exportado desde la aplicación anterior para incorporar sus datos.</p><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} hidden /><PrimaryButton onClick={() => fileRef.current?.click()} icon={Upload}>Seleccionar CSV</PrimaryButton></Card>
    </div>
    <Card className="data-summary"><div className="table-toolbar"><div><h2>Resumen de información local</h2><p>{nativeStorage ? 'Los datos se almacenan en SQLite dentro de este equipo.' : 'Los datos se almacenan en este navegador durante la prueba web de v2.0.'}</p></div></div><div className="summary-grid"><div><Package size={20} /><strong>{data.products.length}</strong><span>Productos</span></div><div><Users size={20} /><strong>{data.clients.length}</strong><span>Clientes</span></div><div><BadgeDollarSign size={20} /><strong>{data.specialPrices.length}</strong><span>Precios especiales</span></div></div><div className="danger-zone"><div><strong>Restablecer datos locales</strong><span>Elimina la información de v2.0 de este equipo. La base v1.3 no se toca.</span></div><button className="danger-button" onClick={onClear}><Trash2 size={17} /> Eliminar datos locales</button></div></Card>
  </>;
}

function SettingsPage({ data, onClear }) {
  const nativeStorage = isTauriRuntime();
  return <><PageHeader title="Ajustes" description="Preferencias de la aplicación local." /><Card className="settings-card"><div className="settings-row"><div className="heading-icon gray"><Settings size={21} /></div><div><h2>{nativeStorage ? 'SQLite local activo' : 'Modo local activo'}</h2><p>{nativeStorage ? 'La información se guarda en una base SQLite dentro de la carpeta de datos de la aplicación.' : 'La información se guarda en el navegador durante la prueba web de v2.0.'}</p></div><span className="status-chip"><span className="status-dot" /> {nativeStorage ? 'SQLite' : 'Sin conexión'}</span></div><div className="settings-row"><div className="heading-icon light-blue"><DatabaseBackup size={21} /></div><div><h2>Datos disponibles</h2><p>{data.products.length} productos · {data.clients.length} clientes · {data.specialPrices.length} precios especiales</p></div><SecondaryButton onClick={onClear} icon={Trash2}>Limpiar datos</SecondaryButton></div></Card></>;
}

function Toast({ toast, onClose }) {
  return <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`} role="status"><span className="toast-icon">{toast.type === 'error' ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}</span><span>{toast.message}</span><button aria-label="Cerrar mensaje" onClick={onClose}><X size={17} /></button></div>;
}

createRoot(document.getElementById('root')).render(<App />);

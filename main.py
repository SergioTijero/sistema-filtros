import sqlite3
import os
import threading
import urllib.request
import webbrowser
import subprocess
import sys
import tempfile
from typing import Tuple, Optional, List

# ==========================================
# CONFIGURATION & THEME
# ==========================================
class Config:
    DB_NAME = "inventory.db"
    APP_TITLE = "Filtros Express PRO"
    
    # --- Color Palette (High Contrast / Professional) ---
    
    # Backgrounds
    COL_SIDEBAR_BG = "#0f172a"    # Slate 900 (Deep Blue/Black)
    COL_SIDEBAR_ACTIVE = "#1e293b"# Slate 800
    COL_MAIN_BG = "#f8fafc"       # Slate 50 (Very light cool gray)
    COL_CARD_BG = "#ffffff"       # Pure White
    
    # Text
    COL_TEXT_TITLE = "#0f172a"    # Slate 900
    COL_TEXT_BODY = "#334155"     # Slate 700
    COL_TEXT_MUTED = "#64748b"    # Slate 500
    COL_TEXT_WHITE = "#f1f5f9"    # Slate 100
    
    # Accents & Actions
    COL_PRIMARY = "#2563eb"       # Blue 600
    COL_PRIMARY_HOVER = "#1d4ed8" # Blue 700
    
    COL_SUCCESS = "#16a34a"       # Green 600
    COL_SUCCESS_HOVER = "#15803d" # Green 700
    
    COL_DANGER = "#dc2626"        # Red 600
    COL_WARNING = "#ca8a04"       # Yellow 600
    
    COL_BORDER = "#e2e8f0"        # Slate 200

    # Fonts
    FONT_FAMILY = "Segoe UI"

    # Version Control
    VERSION = "1.0"
    # URL RAW del archivo version.txt para comprobar actualizaciones
    UPDATE_URL_RAW = "https://raw.githubusercontent.com/SergioTijero/sistema-filtros/main/version.txt" 
    # Plantilla de Descarga del Instalador (se remplaza {ver} por el numero)
    DOWNLOAD_URL_TEMPLATE = "https://github.com/SergioTijero/sistema-filtros/releases/download/v{ver}/Setup_FiltrosExpress.exe"
    
    @classmethod
    def font_h1(cls): return (cls.FONT_FAMILY, 26, "bold")
    @classmethod
    def font_h2(cls): return (cls.FONT_FAMILY, 16, "bold")
    @classmethod
    def font_body(cls): return (cls.FONT_FAMILY, 11)
    @classmethod
    def font_bold(cls): return (cls.FONT_FAMILY, 11, "bold")
    @classmethod
    def font_price(cls): return (cls.FONT_FAMILY, 54, "bold")

# ==========================================
# CUSTOM UI COMPONENTS (Fixed for Mac/Windows Match)
# ==========================================
class PrimaryButton(tk.Label):
    """
    Simulates a Button using a Label to ensure colors work on macOS.
    """
    def __init__(self, parent, text, command, state="normal", bg_color=Config.COL_PRIMARY, hover_color=Config.COL_PRIMARY_HOVER):
        super().__init__(parent, text=text, 
                         bg=bg_color, fg=Config.COL_TEXT_WHITE, 
                         font=Config.font_bold(), 
                         cursor="hand2" if state=="normal" else "arrow",
                         pady=10, padx=20)
        self.command = command
        self.state_val = state
        self.bg_normal = bg_color
        self.bg_hover = hover_color
        
        if state == "disabled":
            self.configure(bg="#cbd5e1", cursor="arrow")
            
        self.bind("<Button-1>", self.on_click)
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def config(self, **kwargs):
        if "state" in kwargs:
            self.state_val = kwargs.pop("state")
            if self.state_val == "disabled":
                self.configure(bg="#cbd5e1", cursor="arrow")
            else:
                self.configure(bg=self.bg_normal, cursor="hand2")
        super().configure(**kwargs)

    def on_click(self, e):
        if self.state_val == "normal" and self.command:
            self.command()

    def on_enter(self, e):
        if self.state_val == "normal":
            self['bg'] = self.bg_hover

    def on_leave(self, e):
        if self.state_val == "normal":
            self['bg'] = self.bg_normal

class SidebarButton(tk.Label):
    def __init__(self, parent, text, command, icon_char=""):
        super().__init__(parent, text=f"{icon_char}  {text}", 
                         font=("Segoe UI", 12), anchor="w", padx=25, pady=12,
                         bg=Config.COL_SIDEBAR_BG, fg=Config.COL_TEXT_WHITE, 
                         cursor="hand2")
        self.command = command
        self.bind("<Button-1>", lambda e: self.command())
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def on_enter(self, e):
        self['bg'] = Config.COL_SIDEBAR_ACTIVE

    def on_leave(self, e):
        self['bg'] = Config.COL_SIDEBAR_BG

class RoundedCard(tk.Frame):
    """Simulates a card with a border."""
    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.configure(bg=Config.COL_CARD_BG, highlightbackground=Config.COL_BORDER, highlightthickness=1)

class Divider(tk.Frame):
    def __init__(self, parent):
        super().__init__(parent, height=1, bg=Config.COL_BORDER)

class CustomEntry(tk.Entry):
    """
    Standard tk.Entry with fixed styling to avoid Mac Dark Mode issues.
    """
    def __init__(self, parent, font=None):
        super().__init__(parent, font=font, 
                         bg="#ffffff", fg="#0f172a",  # Force White BG, Dark Text
                         insertbackground="#0f172a",  # Dark Cursor
                         relief="flat", highlightthickness=1, highlightbackground=Config.COL_BORDER)

class ListViewWindow(tk.Toplevel):
    def __init__(self, parent, title, columns, data):
        super().__init__(parent)
        self.title(title)
        self.geometry("600x600")
        self.configure(bg=Config.COL_MAIN_BG)
        
        # Style Treeview
        style = ttk.Style()
        style.configure("Treeview", 
                        background="white", 
                        foreground=Config.COL_TEXT_BODY, 
                        rowheight=30, 
                        fieldbackground="white",
                        font=Config.font_body())
        style.configure("Treeview.Heading", 
                        font=Config.font_bold(), 
                        background=Config.COL_SIDEBAR_BG, 
                        foreground=Config.COL_TEXT_TITLE) 
        
        tree = ttk.Treeview(self, columns=columns, show="headings", style="Treeview")
        
        for col in columns:
            tree.heading(col, text=col.upper())
            tree.column(col, width=100)
            
        sb = ttk.Scrollbar(self, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=sb.set)
        
        sb.pack(side="right", fill="y")
        tree.pack(side="left", fill="both", expand=True)
        
        for row in data:
            tree.insert("", "end", values=row)

class AutocompleteEntry(tk.Frame):
    def __init__(self, parent, suggestions=None, font=Config.font_body()):
        super().__init__(parent, bg=parent['bg'])
        self.suggestions = suggestions or []
        self.var = tk.StringVar()
        
        self.entry = CustomEntry(self, font=font)
        self.entry.pack(fill="x", ipady=5)
        self.entry.configure(textvariable=self.var)
        self.entry.bind("<KeyRelease>", self.on_keyrelease)
        self.entry.bind("<FocusOut>", self.on_focus_out)
        
        self.listbox = tk.Listbox(self, font=font, bg="#ffffff", fg="#0f172a", relief="flat", highlightthickness=1)
        self.listbox.bind("<<ListboxSelect>>", self.on_select)
        
        # We don't pack listbox yet, only show when filtering
        
    def set_suggestions(self, suggestions):
        self.suggestions = suggestions

    def on_keyrelease(self, event):
        val = self.var.get().upper()
        if not val:
            self.listbox.place_forget()
            return
            
        filtered = [x for x in self.suggestions if val in x.upper()]
        
        if filtered:
            self.show_listbox(filtered)
        else:
            self.listbox.place_forget()

    def show_listbox(self, items):
        self.listbox.delete(0, tk.END)
        for item in items:
            self.listbox.insert(tk.END, item)
        
        # Position listbox below entry
        h = min(len(items), 5) * 20 + 5 # Limit height
        self.listbox.place(x=0, y=self.entry.winfo_height(), relwidth=1.0, height=h)
        self.listbox.lift()

    def on_select(self, event):
        if self.listbox.curselection():
            index = self.listbox.curselection()[0]
            val = self.listbox.get(index)
            self.var.set(val)
            self.listbox.place_forget()
            self.entry.focus_set()

    def on_focus_out(self, event):
        # Delay hiding to allow click event to register
        self.after(200, lambda: self.listbox.place_forget())

    def get(self):
        return self.var.get()

    def set(self, val):
        self.var.set(val)


# ==========================================
# DATABASE SERVICE
# ==========================================
class DatabaseService:
    def __init__(self, db_name: str):
        self.db_name = db_name
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_name)

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    cost REAL NOT NULL,
                    price REAL NOT NULL,
                    stock INTEGER NOT NULL DEFAULT 0
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS clients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS special_prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id INTEGER,
                    product_id INTEGER,
                    price REAL NOT NULL,
                    FOREIGN KEY(client_id) REFERENCES clients(id),
                    FOREIGN KEY(product_id) REFERENCES products(id),
                    UNIQUE(client_id, product_id)
                )
            ''')
            conn.commit()

    def upsert_product(self, code: str, cost: float, price: float, stock: int) -> str:
        code = code.strip().upper()
        if not code: return "Código inválido."
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM products WHERE code=?", (code,))
                if cursor.fetchone():
                    cursor.execute("UPDATE products SET cost=?, price=?, stock=? WHERE code=?", (cost, price, stock, code))
                    return f"Producto {code} actualizado."
                else:
                    cursor.execute("INSERT INTO products (code, cost, price, stock) VALUES (?, ?, ?, ?)", (code, cost, price, stock))
                    return f"Producto {code} creado."
        except Exception as e:
            return f"Error: {e}"

    def register_client(self, name: str) -> str:
        name = name.strip().upper()
        if not name: return "Nombre inválido."
        try:
            with self._get_connection() as conn:
                conn.execute("INSERT INTO clients (name) VALUES (?)", (name,))
                return f"Cliente {name} registrado."
        except sqlite3.IntegrityError:
            return "El cliente ya existe."
        except Exception as e:
            return f"Error: {e}"

    def set_special_price(self, client_name: str, product_code: str, price: float) -> str:
        client_name = client_name.strip().upper()
        product_code = product_code.strip().upper()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM clients WHERE name=?", (client_name,))
            res_client = cursor.fetchone()
            if not res_client: return "Cliente no encontrado."
            
            cursor.execute("SELECT id FROM products WHERE code=?", (product_code,))
            res_prod = cursor.fetchone()
            if not res_prod: return "Producto no encontrado."
            
            try:
                cursor.execute('''
                    INSERT INTO special_prices (client_id, product_id, price) 
                    VALUES (?, ?, ?)
                    ON CONFLICT(client_id, product_id) DO UPDATE SET price=excluded.price
                ''', (res_client[0], res_prod[0], price))
                return "Precio especial configurado."
            except Exception as e:
                return f"Error: {e}"

    def lookup_price(self, client_name: str, product_code: str) -> Tuple[bool, float, bool, int, float]:
        product_code = product_code.strip().upper()
        client_name = client_name.strip().upper() if client_name else ""
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, cost, price, stock FROM products WHERE code=?", (product_code,))
            prod = cursor.fetchone()
            
            if not prod:
                return False, 0.0, False, 0, 0.0
            
            pid, cost, normal_price, stock = prod
            
            if not client_name:
                return True, normal_price, False, stock, cost
            
            cursor.execute("SELECT id FROM clients WHERE name=?", (client_name,))
            client = cursor.fetchone()
            
            if client:
                cid = client[0]
                cursor.execute("SELECT price FROM special_prices WHERE client_id=? AND product_id=?", (cid, pid))
                special = cursor.fetchone()
                if special:
                    return True, special[0], True, stock, cost
            
            return True, normal_price, False, stock, cost

    def reduce_stock(self, product_code: str) -> bool:
        product_code = product_code.strip().upper()
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE products SET stock = stock - 1 WHERE code = ?", (product_code,))
                return cursor.rowcount > 0
        except:
            return False

    def get_all_clients(self) -> List[str]:
        with self._get_connection() as conn:
            res = conn.execute("SELECT name FROM clients ORDER BY name").fetchall()
            return [r[0] for r in res]

    def get_inventory_summary(self) -> List[Tuple]:
        with self._get_connection() as conn:
            return conn.execute("SELECT code, stock, price, cost FROM products ORDER BY code").fetchall()

    def get_clients_summary(self) -> List[Tuple]:
        with self._get_connection() as conn:
            return conn.execute("SELECT id, name FROM clients ORDER BY name").fetchall()

# ==========================================
# UPDATE CHECKER
# ==========================================
class UpdateChecker:
    @staticmethod
    def check_for_updates(callback):
        def _check():
            try:
                # 1 second timeout to not block if offline
                with urllib.request.urlopen(Config.UPDATE_URL_RAW, timeout=3) as response:
                    data = response.read().decode('utf-8').strip()
                    if data > Config.VERSION:
                        callback(data)
            except:
                pass # Silent fail if offline or invalid URL
        
        thread = threading.Thread(target=_check, daemon=True)
        thread.start()

# ==========================================
# MAIN APPLICATION
# ==========================================
class MainApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{Config.APP_TITLE} (v{Config.VERSION})")
        self.geometry("1150x750")
        self.configure(bg=Config.COL_SIDEBAR_BG)
        
        self.db = DatabaseService(Config.DB_NAME)
        
        self._setup_layout()
        
        self.view_consult = ConsultView(self.main_area, self.db)
        self.view_admin = AdminView(self.main_area, self.db)
        
        self.show_view("consult")
        
        # Check Updates
        UpdateChecker.check_for_updates(self.on_update_found)

    def on_update_found(self, new_version):
        # Thread-safe UI update
        self.after(0, lambda: self.show_update_btn(new_version))

    def show_update_btn(self, new_version):
        self.btn_update = SidebarButton(self.sidebar, f"ACTUALIZAR (v{new_version})", 
                                        lambda: self.download_and_install(new_version), "🚀")
        self.btn_update.configure(bg=Config.COL_SUCCESS, fg="white", activebackground=Config.COL_SUCCESS_HOVER)
        self.btn_update.pack(side="bottom", fill="x", pady=0)
        # Move version label up or hide it
        self.lbl_ver.pack_forget()

    def download_and_install(self, new_version):
        if not messagebox.askyesno("Actualización", f"Se ha encontrado la versión {new_version}.\n\nEl programa se cerrará para descargar e instalar lare nueva versión automáticamente.\n\n¿Deseas continuar?"):
            return
            
        url = Config.DOWNLOAD_URL_TEMPLATE.format(ver=new_version)
        installer_path = os.path.join(tempfile.gettempdir(), f"Setup_FiltrosExpress_v{new_version}.exe")
        
        # Show progress (Simple blocking for now to keep it lightweight)
        # In a real app we'd use a progress bar window
        self.btn_update.configure(text="DESCARGANDO...", state="disabled")
        self.update_idletasks()
        
        def _dl_worker():
            try:
                urllib.request.urlretrieve(url, installer_path)
                self.after(0, lambda: self._run_installer(installer_path))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Error", f"Error al descargar: {str(e)}"))
                self.after(0, lambda: self.btn_update.configure(text=f"REINTENTAR (v{new_version})", state="normal"))

        threading.Thread(target=_dl_worker, daemon=True).start()

    def _run_installer(self, path):
        messagebox.showinfo("Listo", "La descarga se completó.\n\nEl instalador se abrirá ahora.")
        try:
            subprocess.Popen([path], shell=True)
            self.destroy() # Close App
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo abrir el instalador: {e}")
        
    def _setup_layout(self):
        # Sidebar
        self.sidebar = tk.Frame(self, bg=Config.COL_SIDEBAR_BG, width=260)
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)
        
        # Logo
        lbl_title = tk.Label(self.sidebar, text="FILTROS\nEXPRESS", font=("Segoe UI", 22, "bold"), 
                             bg=Config.COL_SIDEBAR_BG, fg=Config.COL_PRIMARY, justify="left")
        lbl_title.pack(pady=(50, 40), padx=30, anchor="w")
        
        # Nav Buttons
        SidebarButton(self.sidebar, "Consultar Precios", lambda: self.show_view("consult"), "🔍").pack(fill="x")
        SidebarButton(self.sidebar, "Administración", lambda: self.show_view("admin"), "⚙️").pack(fill="x")
        
        # Version
        self.lbl_ver = tk.Label(self.sidebar, text=f"v{Config.VERSION} PRO", font=("Segoe UI", 9), bg=Config.COL_SIDEBAR_BG, fg="#475569")
        self.lbl_ver.pack(side="bottom", pady=20)

        # Right Main Area
        self.main_area = tk.Frame(self, bg=Config.COL_MAIN_BG)
        self.main_area.pack(side="right", fill="both", expand=True)

    def show_view(self, view_name):
        for widget in self.main_area.winfo_children():
            widget.pack_forget()
            
        if view_name == "consult":
            self.view_consult.pack(fill="both", expand=True, padx=40, pady=30)
            self.view_consult.load_suggestions() # Refresh suggestions on view
            self.view_consult.focus_search()
        elif view_name == "admin":
            self.view_admin.pack(fill="both", expand=True, padx=40, pady=30)
            self.view_admin.refresh()

# ==========================================
# VIEW: CONSULT
# ==========================================
class ConsultView(tk.Frame):
    def __init__(self, parent, db: DatabaseService):
        super().__init__(parent, bg=Config.COL_MAIN_BG)
        self.db = db
        self.current_code = None
        self._build_ui()
        
    def _build_ui(self):
        # Header
        tk.Label(self, text="Consulta de Precios", font=Config.font_h1(), bg=Config.COL_MAIN_BG, fg=Config.COL_TEXT_TITLE).pack(anchor="w", pady=(0, 25))
        
        # Card
        search_card = RoundedCard(self)
        search_card.pack(fill="x", pady=(0, 25), ipady=5)
        
        # Search Form
        form = tk.Frame(search_card, bg=Config.COL_CARD_BG)
        form.pack(fill="x", padx=25, pady=25)
        
        # Client
        tk.Label(form, text="CLIENTE (OPCIONAL)", font=Config.font_bold(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_MUTED).pack(anchor="w")
        self.ent_client = AutocompleteEntry(form, font=Config.font_body())
        self.ent_client.pack(fill="x", pady=(5, 15))
        
        # Code
        tk.Label(form, text="CODIGO DEL FILTRO", font=Config.font_bold(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_MUTED).pack(anchor="w")
        self.ent_code = CustomEntry(form, font=("Segoe UI", 16))
        self.ent_code.pack(fill="x", pady=(5, 20), ipady=5)
        self.ent_code.bind("<Return>", lambda e: self.do_search())
        
        PrimaryButton(form, "� BUSCAR PRECIO", self.do_search).pack(fill="x")
        
        # Results
        self.res_card = RoundedCard(self)
        self.res_card.pack(fill="both", expand=True)
        
        self.lbl_res_name = tk.Label(self.res_card, text="Ingrese un código...", font=Config.font_h2(), bg=Config.COL_CARD_BG, fg="#cbd5e1")
        self.lbl_res_name.pack(pady=(50, 10))
        
        self.lbl_res_price_type = tk.Label(self.res_card, text="", font=Config.font_body(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_MUTED)
        self.lbl_res_price_type.pack()
        
        self.lbl_res_price = tk.Label(self.res_card, text="", font=Config.font_price(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_TITLE)
        self.lbl_res_price.pack(pady=10)
        
        self.lbl_res_stock = tk.Label(self.res_card, text="", font=("Segoe UI", 14), bg=Config.COL_CARD_BG)
        self.lbl_res_stock.pack(pady=5)
        
        self.btn_sell = PrimaryButton(self.res_card, "✅ REGISTRAR VENTA ( -1 )", self.do_sell, 
                                      state="disabled", bg_color=Config.COL_SUCCESS, hover_color=Config.COL_SUCCESS_HOVER)
        self.btn_sell.pack(pady=30, ipadx=20)
        
    def focus_search(self):
        self.ent_code.focus_set()

    def load_suggestions(self):
        clients = self.db.get_all_clients()
        self.ent_client.set_suggestions(clients)
        
    def do_search(self):
        client = self.ent_client.get()
        code = self.ent_code.get()
        
        if not code: return
        
        found, price, is_special, stock, cost = self.db.lookup_price(client, code)
        
        if found:
            self.current_code = code
            self.lbl_res_name.config(text=f"Filtro: {code.upper()}", fg=Config.COL_TEXT_TITLE)
            self.lbl_res_price.config(text=f"S/ {price:.2f}")
            
            if is_special:
                self.lbl_res_price_type.config(text=f"PRECIO ESPECIAL ({client.upper()}) 🔥", fg=Config.COL_SUCCESS)
                self.lbl_res_price.config(fg=Config.COL_SUCCESS)
            else:
                self.lbl_res_price_type.config(text="PRECIO DE LISTA", fg=Config.COL_TEXT_MUTED)
                self.lbl_res_price.config(fg=Config.COL_TEXT_TITLE)
                
            stock_fg = Config.COL_DANGER if stock < 3 else(Config.COL_WARNING if stock < 5 else Config.COL_PRIMARY)
            self.lbl_res_stock.config(text=f"Stock Actual: {stock}", fg=stock_fg)
            
            self.btn_sell.config(state="normal", bg=Config.COL_SUCCESS)
        else:
            self.current_code = None
            self.lbl_res_name.config(text=f"No encontrado: {code}", fg=Config.COL_DANGER)
            self.lbl_res_price.config(text="---")
            self.lbl_res_stock.config(text="")
            self.lbl_res_price_type.config(text="")
            self.btn_sell.config(state="disabled", bg="#cbd5e1") # Gray out

    def do_sell(self):
        if not self.current_code: return
        if self.db.reduce_stock(self.current_code):
            messagebox.showinfo("Venta Exitosa", f"Se vendió 1 unidad de {self.current_code}")
            self.do_search()
        else:
            messagebox.showerror("Error", "Error al actualizar stock")

# ==========================================
# VIEW: ADMIN
# ==========================================
class AdminView(tk.Frame):
    def __init__(self, parent, db: DatabaseService):
        super().__init__(parent, bg=Config.COL_MAIN_BG)
        self.db = db
        self._build_ui()
        
    def _build_ui(self):
        tk.Label(self, text="Administración", font=Config.font_h1(), bg=Config.COL_MAIN_BG, fg=Config.COL_TEXT_TITLE).pack(anchor="w", pady=(0, 25))

        container = tk.Frame(self, bg=Config.COL_MAIN_BG)
        container.pack(fill="both", expand=True)
        
        # --- PRODUCTS ---
        c_prod = RoundedCard(container)
        c_prod.pack(side="left", fill="both", expand=True, padx=(0, 15))
        
        tk.Label(c_prod, text="📦 Gestión de Inventario", font=Config.font_h2(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_TITLE).pack(anchor="w", padx=25, pady=25)
        
        self.ent_p_code = self._mk_input(c_prod, "CÓDIGO")
        self.ent_p_cost = self._mk_input(c_prod, "COSTO DE COMPRA")
        self.ent_p_price = self._mk_input(c_prod, "PRECIO DE VENTA")
        self.ent_p_stock = self._mk_input(c_prod, "STOCK ACTUAL")
        
        PrimaryButton(c_prod, "GUARDAR PRODUCTO", self.save_prod).pack(fill="x", padx=25, pady=(25, 10))
        PrimaryButton(c_prod, "📂 VER LISTA COMPLETA", self.show_inv_list, bg_color="#475569", hover_color="#334155").pack(fill="x", padx=25, pady=(0, 25))

        # --- SPECIALS ---
        c_spec = RoundedCard(container)
        c_spec.pack(side="right", fill="both", expand=True, padx=(15, 0))
        
        tk.Label(c_spec, text="⭐ Clientes y Ofertas", font=Config.font_h2(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_TITLE).pack(anchor="w", padx=25, pady=25)
        
        # New Client
        f_cli = tk.Frame(c_spec, bg=Config.COL_CARD_BG)
        f_cli.pack(fill="x", padx=25)
        tk.Label(f_cli, text="NUEVO CLIENTE", font=Config.font_bold(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_MUTED).pack(anchor="w")
        self.ent_c_name = CustomEntry(f_cli, font=Config.font_body())
        self.ent_c_name.pack(fill="x", pady=(5, 10), ipady=3)
        PrimaryButton(f_cli, "Registrar Cliente", self.save_client, bg_color="#64748b", hover_color="#475569").pack(fill="x", pady=(0, 5))
        
        # Client List Button
        PrimaryButton(f_cli, "👥 VER TODOS LOS CLIENTES", self.show_client_list, bg_color="#94a3b8", hover_color="#64748b").pack(fill="x")
        
        # Divider
        Divider(c_spec).pack(fill="x", padx=25, pady=25)
        
        # Assign Price
        tk.Label(c_spec, text="CLIENTE EXISTENTE", font=Config.font_bold(), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_MUTED).pack(anchor="w", padx=25)
        self.ac_clients = AutocompleteEntry(c_spec, font=Config.font_body())
        self.ac_clients.pack(fill="x", padx=25, pady=(5, 15))
        
        self.ent_s_code = self._mk_input(c_spec, "CÓDIGO PRODUCTO")
        self.ent_s_price = self._mk_input(c_spec, "PRECIO ESPECIAL")
        
        PrimaryButton(c_spec, "ASIGNAR PRECIO", self.save_special, bg_color=Config.COL_SIDEBAR_BG, hover_color=Config.COL_SIDEBAR_ACTIVE).pack(fill="x", padx=25, pady=25)

    def _mk_input(self, parent, label):
        tk.Label(parent, text=label, font=("Segoe UI", 9, "bold"), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_MUTED).pack(anchor="w", padx=25)
        ent = CustomEntry(parent, font=Config.font_body())
        ent.pack(fill="x", padx=25, pady=(5, 15), ipady=3)
    def _mk_input(self, parent, label):
        tk.Label(parent, text=label, font=("Segoe UI", 9, "bold"), bg=Config.COL_CARD_BG, fg=Config.COL_TEXT_MUTED).pack(anchor="w", padx=25)
        ent = CustomEntry(parent, font=Config.font_body())
        ent.pack(fill="x", padx=25, pady=(5, 15), ipady=3)
        return ent

    def refresh(self):
        clients = self.db.get_all_clients()
        self.ac_clients.set_suggestions(clients)

    def save_prod(self):
        try:
            msg = self.db.upsert_product(self.ent_p_code.get(), float(self.ent_p_cost.get()), float(self.ent_p_price.get()), int(self.ent_p_stock.get()))
            messagebox.showinfo("Inventario", msg)
            for e in [self.ent_p_code, self.ent_p_cost, self.ent_p_price, self.ent_p_stock]: e.delete(0, tk.END)
        except ValueError:
            messagebox.showerror("Error", "Revise los datos numéricos.")
            
    def save_client(self):
        msg = self.db.register_client(self.ent_c_name.get())
        messagebox.showinfo("Clientes", msg)
        self.ent_c_name.delete(0, tk.END)
        self.refresh()
        
    def save_special(self):
        try:
            msg = self.db.set_special_price(self.ac_clients.get(), self.ent_s_code.get(), float(self.ent_s_price.get()))
            messagebox.showinfo("Precios", msg)
            self.ent_s_code.delete(0, tk.END); self.ent_s_price.delete(0, tk.END)
        except ValueError:
            messagebox.showerror("Error", "Precio inválido.")

    def show_inv_list(self):
        data = self.db.get_inventory_summary()
        # Columns: code, stock, price, cost
        ListViewWindow(self, "Inventario Completo", ["Código", "Stock", "Precio", "Costo"], data)

    def show_client_list(self):
        data = self.db.get_clients_summary()
        # Columns: id, name
        ListViewWindow(self, "Cartera de Clientes", ["ID", "Nombre"], data)

if __name__ == "__main__":
    app = MainApp()
    app.mainloop()

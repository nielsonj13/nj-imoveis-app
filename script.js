import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- SUAS CHAVES DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBaTEAysfxynSR1BKHdQVv0tGq3JvqafnU",
    authDomain: "nj-imoveis.firebaseapp.com",
    projectId: "nj-imoveis",
    storageBucket: "nj-imoveis.firebasestorage.app",
    messagingSenderId: "424594631604",
    appId: "1:424594631604:web:7b597e6700ddb39183a0e1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const imoveisRef = collection(db, "imoveis");

// Variáveis Globais
let todosImoveis = [];
let modalDetalhes = null, modalForm = null, modalLocacao = null, modalNotificacoes = null;

// --- INICIALIZAÇÃO ---
window.onload = () => {
    // Inicializa os Modais do Bootstrap
    modalDetalhes = new bootstrap.Modal(document.getElementById('modalDetalhes'));
    modalForm = new bootstrap.Modal(document.getElementById('modalFormulario'));
    modalLocacao = new bootstrap.Modal(document.getElementById('modalAlugar'));
    modalNotificacoes = new bootstrap.Modal(document.getElementById('modalNotificacoes'));
    
    // Verifica Tema (Dark/Light)
    if (localStorage.getItem('tema') === 'dark') document.documentElement.setAttribute('data-bs-theme', 'dark');

    // Listener para Preview de Foto no Cadastro
    const inputFoto = document.getElementById('inputFoto');
    if(inputFoto) {
        inputFoto.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            const previewContainer = document.getElementById('previewContainer');
            if(file) {
                const base64 = await comprimirParaBase64(file);
                document.getElementById('previewFoto').src = base64;
                previewContainer.style.display = 'block';
            } else {
                previewContainer.style.display = 'none';
            }
        });
    }
}

// --- FUNÇÃO DE COMPRESSÃO DE IMAGEM (BASE64) ---
const comprimirParaBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 800; // Largura máxima para não pesar o banco
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Retorna imagem JPG com qualidade 60%
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            }
            img.onerror = (err) => reject(err);
        }
    });
}

// --- AUTENTICAÇÃO (LOGIN/LOGOUT) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        iniciarListener(); // Começa a baixar os dados só depois de logar
    } else {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }
});

document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const msg = document.getElementById('msgErroLogin');
    btn.disabled = true; btn.innerText = "Verificando..."; msg.style.display = 'none';
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('emailLogin').value, document.getElementById('senhaLogin').value);
    } catch (err) { 
        msg.innerText = "Login inválido."; msg.style.display = 'block'; 
        btn.disabled = false; btn.innerText = "Acessar Sistema";
    }
});

// --- LISTENER DE DADOS (REALTIME) ---
function iniciarListener() {
    onSnapshot(imoveisRef, (snap) => {
        todosImoveis = [];
        snap.forEach((d) => todosImoveis.push({ id: d.id, data: d.data() }));
        atualizarCidades();
        window.aplicarFiltros(); // Atualiza a lista na tela
        atualizarDashboard();
        checarVencimentos();
    });
}

// --- RENDERIZAÇÃO DA LISTA ---
const renderizarLista = (lista) => {
    const div = document.getElementById('listaImoveis');
    document.getElementById('contadorResultados').innerText = `${lista.length} imóveis encontrados`;
    div.innerHTML = '';

    if(lista.length === 0) {
        div.innerHTML = '<div class="col-12 text-center py-5 text-muted opacity-50"><i class="bi bi-search display-1"></i><p>Nenhum imóvel encontrado.</p></div>';
        return;
    }

    lista.forEach((d) => {
        const i = d.data;
        const statusClass = i.alugado ? 'status-border-ocupado' : 'status-border-livre';
        
        // Decide se mostra FOTO ou MAPA no card
        let midia = '';
        if(i.fotoUrl && i.fotoUrl.startsWith('data:image')) {
            midia = `<img src="${i.fotoUrl}" alt="${i.nome}">`;
        } else {
            const endEnc = encodeURIComponent(i.endereco.completo || i.endereco);
            midia = `<iframe src="https://maps.google.com/maps?q=$${endEnc}&t=&z=15&ie=UTF8&iwloc=&output=embed"></iframe>`;
        }

        // Tipo do imóvel (Badge cinza pequeno)
        const tipoBadge = i.tipo ? `<span class="badge bg-secondary ms-2" style="font-size: 0.6rem">${i.tipo}</span>` : '';

        div.innerHTML += `
            <div class="col-md-6 col-lg-4">
                <div class="card property-card h-100 ${statusClass}" onclick="window.abrirDetalhes('${d.id}')">
                    <div class="media-container">${midia}</div>
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between mb-2">
                            <div class="text-truncate" style="max-width: 65%">
                                <h5 class="fw-bold mb-0">${i.nome}</h5>
                            </div>
                            <span class="custom-badge ${i.alugado ? 'badge-ocupado':'badge-livre'}">${i.alugado ? 'Alugado':'Livre'}</span>
                        </div>
                        <p class="text-muted small text-truncate mb-2">${i.endereco.completo || i.endereco}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <h4 class="text-primary fw-bold mb-0">${new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(i.valor)}</h4>
                            ${tipoBadge}
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// --- FUNÇÃO: ABRIR DETALHES (FICHA COMPLETA) ---
window.abrirDetalhes = (id) => {
    const item = todosImoveis.find(i => i.id === id);
    if (!item) return;
    const i = item.data;

    // --- PREENCHIMENTO BÁSICO ---
    document.getElementById('detalheNome').innerText = i.nome;
    document.getElementById('detalheEndereco').innerText = i.endereco.completo || i.endereco;
    document.getElementById('detalheValor').innerText = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(i.valor);
    
    document.getElementById('detalheTipo').innerText = i.tipo || 'Imóvel';
    document.getElementById('detalheQuartos').innerText = i.quartos || '-';
    document.getElementById('detalheBanheiros').innerText = i.banheiros || '-';
    document.getElementById('detalheVagas').innerText = i.vagas || '-';
    document.getElementById('detalheArea').innerText = i.area || '-';
    document.getElementById('detalheDescricao').innerText = i.descricao || 'Sem observações.';

    const capa = document.getElementById('detalheCapa');
    if(i.fotoUrl && i.fotoUrl.startsWith('data:image')) {
        capa.style.backgroundImage = `url('${i.fotoUrl}')`;
    } else {
        capa.style.backgroundImage = 'none';
        capa.style.backgroundColor = '#64748b';
    }

    // --- LÓGICA DO INQUILINO E BOTÕES ---
    const areaInq = document.getElementById('areaInquilinoDetalhe');
    const btnLocacao = document.getElementById('btnDetalheLocacao');
    
    if (i.alugado) {
        areaInq.classList.remove('d-none');
        document.getElementById('detalheInquilinoNome').innerText = i.inquilino;
        document.getElementById('detalheInquilinoTel').innerText = i.telefone || '-';
        document.getElementById('detalheVencimento').innerText = i.diaVencimento;
        
        // 1. Configura Botão ZAP
        document.getElementById('btnDetalheZap').onclick = () => window.cobrarNoZap(i.inquilino, i.telefone, i.nome, i.diaVencimento);
        
        // 2. Configura Botão CONTRATO
        const btnContrato = document.getElementById('btnGerarContrato');
        if(btnContrato) btnContrato.onclick = () => window.gerarContratoPDF(id);

        // 3. Configura Botão IGNORAR (Agora estático e organizado)
        const btnAdiar = document.getElementById('btnDetalheAdiar');
        const mesAtual = new Date().getMonth();
        
        // Se já ignorou este mês, esconde o botão. Se não, mostra.
        if(i.ignorarAtrasoMes === mesAtual) {
            btnAdiar.classList.add('d-none'); 
            // Opcional: Expandir o botão de contrato se o adiar sumir
            btnContrato.classList.remove('flex-grow-1');
            btnContrato.classList.add('w-100');
        } else {
            btnAdiar.classList.remove('d-none');
            btnContrato.classList.add('flex-grow-1');
            btnContrato.classList.remove('w-100');
            
            btnAdiar.onclick = async () => {
                if(confirm("Remover este imóvel da lista de pendências deste mês?")) {
                    await updateDoc(doc(db, "imoveis", id), { ignorarAtrasoMes: mesAtual });
                    modalDetalhes.hide(); // Fecha para atualizar listas
                }
            };
        }

        // Configura botão Desocupar
        btnLocacao.innerText = "Desocupar Imóvel";
        btnLocacao.className = "btn btn-outline-danger w-100 fw-bold";
        btnLocacao.onclick = () => { modalDetalhes.hide(); window.gerenciarLocacao(id, true); };
    
    } else {
        // Se estiver livre, esconde tudo
        areaInq.classList.add('d-none');
        btnLocacao.innerText = "Registrar Locação";
        btnLocacao.className = "btn btn-primary w-100 fw-bold";
        btnLocacao.onclick = () => { modalDetalhes.hide(); window.gerenciarLocacao(id, false); };
    }

    // Botões de Edição do Imóvel
    document.getElementById('btnDetalheEditar').onclick = () => { modalDetalhes.hide(); window.prepararEdicao(id); };
    document.getElementById('btnDetalheExcluir').onclick = () => { if(confirm("Excluir imóvel permanentemente?")) { deleteDoc(doc(db,"imoveis",id)); modalDetalhes.hide(); } };

    modalDetalhes.show();
}
// --- SALVAR IMÓVEL (CRIAR OU EDITAR) ---
document.getElementById('formImovel').addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede recarregamento da página
    
    const btnSalvar = document.getElementById('btnSalvar');
    const txtOriginal = btnSalvar.innerText;
    btnSalvar.disabled = true; btnSalvar.innerText = "Salvando...";

    try {
        const idEdicao = document.getElementById('idEdicao').value;
        const fileInput = document.getElementById('inputFoto');
        let fotoFinal = document.getElementById('urlFotoAtual').value;

        // Se o usuário subiu uma foto nova, converte para Base64
        if (fileInput.files.length > 0) {
            fotoFinal = await comprimirParaBase64(fileInput.files[0]);
        }

        const endCompleto = `${document.getElementById('logradouro').value}, ${document.getElementById('numero').value} - ${document.getElementById('bairro').value}, ${document.getElementById('cidade').value}`;
        
        // Monta o objeto com TODOS os campos novos
        const dados = {
            nome: document.getElementById('nome').value,
            valor: parseFloat(document.getElementById('valor').value),
            fotoUrl: fotoFinal,
            // NOVOS CAMPOS
            tipo: document.getElementById('tipoImovel').value,
            quartos: document.getElementById('qtdQuartos').value,
            banheiros: document.getElementById('qtdBanheiros').value,
            vagas: document.getElementById('qtdVagas').value,
            area: document.getElementById('areaTotal').value,
            descricao: document.getElementById('descricao').value,
            // ENDEREÇO
            endereco: {
                cep: document.getElementById('cep').value,
                logradouro: document.getElementById('logradouro').value,
                numero: document.getElementById('numero').value,
                bairro: document.getElementById('bairro').value,
                cidade: document.getElementById('cidade').value,
                uf: document.getElementById('uf').value,
                completo: endCompleto
            }
        };

        if (idEdicao) {
            // Edição: Mantém dados que não estão no form (ex: inquilino, alugado)
            await updateDoc(doc(db, "imoveis", idEdicao), dados);
        } else {
            // Novo: Adiciona campos padrões
            await addDoc(imoveisRef, { ...dados, alugado: false, dataCriacao: new Date() });
        }
        
        modalForm.hide();
        document.getElementById('formImovel').reset();
        document.getElementById('previewContainer').style.display = 'none';
    
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        btnSalvar.disabled = false; btnSalvar.innerText = txtOriginal;
    }
});

// --- FUNÇÃO: PREPARAR EDIÇÃO (POPULAR FORMULÁRIO) ---
window.prepararEdicao = async (id) => {
    try {
        const snap = await getDoc(doc(db, "imoveis", id));
        if (snap.exists()) {
            const d = snap.data();
            
            // IDs Ocultos
            document.getElementById('idEdicao').value = id;
            document.getElementById('urlFotoAtual').value = d.fotoUrl || '';

            // Campos Principais
            document.getElementById('nome').value = d.nome;
            document.getElementById('valor').value = d.valor;
            
            // NOVOS CAMPOS
            document.getElementById('tipoImovel').value = d.tipo || '';
            document.getElementById('qtdQuartos').value = d.quartos || '';
            document.getElementById('qtdBanheiros').value = d.banheiros || '';
            document.getElementById('qtdVagas').value = d.vagas || '';
            document.getElementById('areaTotal').value = d.area || '';
            document.getElementById('descricao').value = d.descricao || '';

            // Endereço
            const e = d.endereco.cep ? d.endereco : { completo: d.endereco };
            if(e.cep) {
                document.getElementById('cep').value = e.cep;
                document.getElementById('logradouro').value = e.logradouro;
                document.getElementById('numero').value = e.numero;
                document.getElementById('bairro').value = e.bairro;
                document.getElementById('cidade').value = e.cidade;
                document.getElementById('uf').value = e.uf;
            }

            // Preview da Foto
            const prevContainer = document.getElementById('previewContainer');
            if(d.fotoUrl && d.fotoUrl.startsWith('data:image')) {
                document.getElementById('previewFoto').src = d.fotoUrl;
                prevContainer.style.display = 'block';
            } else {
                prevContainer.style.display = 'none';
            }

            // Ajusta Título e Botão
            document.getElementById('tituloFormulario').innerText = "Editar Imóvel";
            document.getElementById('btnSalvar').innerText = "Atualizar Cadastro";
            
            modalForm.show();
        }
    } catch(e) { console.error(e); alert("Erro ao carregar dados."); }
}

// --- FILTROS E PESQUISA ---
window.aplicarFiltros = () => {
    const status = document.getElementById('filtroStatus').value;
    const cidade = document.getElementById('filtroCidade').value;
    const termo = document.getElementById('filtroInquilino').value.toLowerCase();
    const soAtrasados = document.getElementById('filtroAtrasados').checked;
    
    // Dados para verificação de pagamento/atraso
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const filtrados = todosImoveis.filter(item => {
        const d = item.data;
        
        // 1. Filtro Status
        if (status === 'livre' && d.alugado) return false;
        if (status === 'alugado' && !d.alugado) return false;
        
        // 2. Filtro Cidade
        if (cidade !== 'todas' && (d.endereco.cidade || "") !== cidade) return false;
        
        // 3. Filtro Nome
        if (termo && (!d.inquilino || !d.inquilino.toLowerCase().includes(termo))) return false;
        
        // 4. Filtro Atrasados (CORRIGIDO)
        if (soAtrasados) {
            // Se não tá alugado, não tá atrasado
            if (!d.alugado || !d.diaVencimento) return false;
            
            const diaVenc = parseInt(d.diaVencimento);
            
            // Verifica se JÁ PAGOU este mês
            let pagoEsteMes = false;
            if (d.ultimoPagamento) {
                const dtPag = new Date(d.ultimoPagamento);
                if (dtPag.getMonth() === mesAtual && dtPag.getFullYear() === anoAtual) pagoEsteMes = true;
            }

            // Verifica se foi ADIADO/IGNORADO este mês
            const ignoradoEsteMes = (d.ignorarAtrasoMes === mesAtual);

            // Lógica Final:
            // Para aparecer aqui, tem que:
            // NÃO ter pago E NÃO ter ignorado E (Dia do vencimento já passou ou é hoje)
            if (pagoEsteMes || ignoradoEsteMes || diaVenc > diaHoje) return false;
        }

        return true;
    });
    
    renderizarLista(filtrados);
}

// --- UTILITÁRIOS ---

window.abrirFormularioNovo = () => {
    document.getElementById('formImovel').reset();
    document.getElementById('idEdicao').value = '';
    document.getElementById('urlFotoAtual').value = '';
    document.getElementById('previewContainer').style.display = 'none';
    
    document.getElementById('tituloFormulario').innerText = "Cadastrar Propriedade";
    document.getElementById('btnSalvar').innerText = "Salvar Imóvel";
    modalForm.show();
}

window.fecharFormulario = () => modalForm.hide();
window.fazerLogout = () => signOut(auth);

window.alternarTema = () => {
    const html = document.documentElement;
    const novoTema = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-bs-theme', novoTema);
    localStorage.setItem('tema', novoTema);
}

window.buscarCep = async (cep) => {
    cep = cep.replace(/\D/g, '');
    if(cep.length !== 8) return;
    try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const d = await r.json();
        if (!d.erro) {
            document.getElementById('logradouro').value = d.logradouro || '';
            document.getElementById('bairro').value = d.bairro || '';
            document.getElementById('cidade').value = d.localidade || '';
            // Preenche o campo UF que agora é visível
            document.getElementById('uf').value = d.uf || ''; 
        }
    } catch(e){}
}

// Funções de Locação
window.gerenciarLocacao = async (id, alugado) => {
    if(alugado) {
        if(confirm("Confirmar desocupação?")) {
            await updateDoc(doc(db,"imoveis",id), {
                alugado: false, inquilino: null, cpf: null, rg: null, telefone: null, diaVencimento: null, prazoContrato: null, dataInicio: null, ultimoPagamento: null, ignorarAtrasoMes: null
            });
        }
    } else {
        document.getElementById('imovelIdParaAlugar').value = id;
        document.getElementById('nomeInquilino').value = '';
        document.getElementById('cpfInquilino').value = '';
        document.getElementById('rgInquilino').value = '';
        document.getElementById('telInquilino').value = '';
        document.getElementById('diaVencimento').value = '';
        document.getElementById('prazoContrato').value = '12';
        
        // Define a data de hoje como padrão no input date
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('dataInicioContrato').value = hoje;
        
        modalLocacao.show();
    }
}

// Função para SALVAR no Banco de Dados
window.confirmarLocacao = async () => {
    const id = document.getElementById('imovelIdParaAlugar').value;
    const nome = document.getElementById('nomeInquilino').value;
    const cpf = document.getElementById('cpfInquilino').value;
    const rg = document.getElementById('rgInquilino').value;
    const tel = document.getElementById('telInquilino').value;
    const dia = document.getElementById('diaVencimento').value;
    const prazo = document.getElementById('prazoContrato').value;
    const dtInicio = document.getElementById('dataInicioContrato').value; // NOVO

    if(nome && dia && cpf && dtInicio) { 
        await updateDoc(doc(db,"imoveis",id), {
            alugado: true, 
            inquilino: nome, 
            cpf: cpf, 
            rg: rg, 
            telefone: tel, 
            diaVencimento: dia,
            prazoContrato: prazo,
            dataInicio: dtInicio, // Salva a data exata
            ultimoPagamento: null,
            ignorarAtrasoMes: null // Reseta qualquer bloqueio de alerta
        }); 
        modalLocacao.hide(); 
    } else { 
        alert("Preencha todos os campos obrigatórios (incluindo Data de Início)!"); 
    }
}

// Funções de Cobrança e Dashboard
window.cobrarNoZap = (nome, telefone, imovel, dia) => {
    if(!telefone) return alert("Sem telefone cadastrado!");
    const link = `https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${nome}, passando para lembrar sobre o aluguel do imóvel *${imovel}* que vence dia ${dia}.`)}`;
    window.open(link, '_blank');
}

window.abrirNotificacoes = () => modalNotificacoes.show();
window.registrarPagamento = async (id) => { 
    if(confirm("Confirmar que este mês foi pago?")) { 
        await updateDoc(doc(db,"imoveis",id),{ultimoPagamento: new Date().toISOString()}); 
    } 
}

const atualizarCidades = () => {
    const s = document.getElementById('filtroCidade'); const val = s.value; const cids = new Set();
    todosImoveis.forEach(i => { if(i.data.endereco?.cidade) cids.add(i.data.endereco.cidade); });
    s.innerHTML = '<option value="todas">Todas</option>'; 
    cids.forEach(c => s.innerHTML += `<option value="${c}">${c}</option>`); 
    s.value = val;
}

const atualizarDashboard = () => {
    let rt=0; let rp=0; let qa=0; let qt=todosImoveis.length;
    todosImoveis.forEach(it => { const i=it.data; if(i.alugado) { rt+=i.valor||0; qa++; } else { rp+=i.valor||0; } });
    document.getElementById('dashReceita').innerText = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(rt);
    document.getElementById('dashOcupacao').innerText = `${qt>0?Math.round((qa/qt)*100):0}%`;
    document.getElementById('dashPerdido').innerText = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(rp);
}

// Função auxiliar para adiar (remover da lista)
window.adiarCobranca = async (id) => {
    if(confirm("Deseja remover este inquilino da lista de atrasados deste mês? (Isso não confirma o pagamento)")) {
        const mesAtual = new Date().getMonth();
        // Marca no banco que o mês X deve ser ignorado para alertas
        await updateDoc(doc(db, "imoveis", id), { ignorarAtrasoMes: mesAtual });
    }
}

// Lógica de Notificações
const checarVencimentos = () => {
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const lista = [];

    todosImoveis.forEach(t => {
        const i = t.data;
        // Só verifica se estiver alugado E tiver vencimento
        if (i.alugado && i.diaVencimento) {
            const diaVenc = parseInt(i.diaVencimento);
            let estaPago = false;
            
            // 1. Verifica se pagou
            if (i.ultimoPagamento) {
                const dataPag = new Date(i.ultimoPagamento);
                if (dataPag.getMonth() === mesAtual && dataPag.getFullYear() === anoAtual) estaPago = true;
            }

            // 2. Verifica se o usuário pediu para IGNORAR este mês (Remover da lista)
            const foiAdiado = (i.ignorarAtrasoMes === mesAtual);

            // Regra: Não Pago + (Venceu hoje ou Passou do dia) + Não Adiado
            if (!estaPago && !foiAdiado && (diaVenc === diaHoje || (diaVenc < diaHoje))) {
                lista.push({ id: t.id, ...i });
            }
        }
    });

    // Renderiza a Lista
    const b = document.getElementById('badgeNotificacao');
    if (lista.length > 0) { b.innerText = lista.length; b.style.display = 'flex'; } else { b.style.display = 'none'; }
    
    const dl = document.getElementById('listaNotificacoes'); 
    dl.innerHTML = '';
    
    if (lista.length === 0) {
        dl.innerHTML = '<p class="text-center text-muted py-3">Nenhuma cobrança pendente.</p>';
    } else {
        lista.forEach(i => {
            const diaVenc = parseInt(i.diaVencimento);
            const statusTexto = (diaVenc === diaHoje) ? 'Vence Hoje' : `Atrasado desde dia ${diaVenc}`;
            
            dl.innerHTML += `
            <div class="card p-2 border-danger bg-danger bg-opacity-10">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong class="text-dark">${i.inquilino}</strong>
                    <span class="badge bg-danger">${statusTexto}</span>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-success flex-grow-1" onclick="window.cobrarNoZap('${i.inquilino}','${i.telefone}','${i.nome}','${i.diaVencimento}')"><i class="bi bi-whatsapp"></i></button>
                    <button class="btn btn-sm btn-primary flex-grow-1" onclick="window.registrarPagamento('${i.id}')" title="Confirmar Pagamento"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.adiarCobranca('${i.id}')" title="Remover da lista (Adiar)"><i class="bi bi-eye-slash"></i></button>
                </div>
            </div>`;
        });
    }
}

// --- FUNÇÃO GERADORA DE CONTRATO ---
window.gerarContratoPDF = (id) => {
    const item = todosImoveis.find(i => i.id === id);
    if (!item) return;
    const i = item.data;

    // --- 1. CÁLCULO DE DATAS ---
    let dtInicioObj = i.dataInicio ? new Date(i.dataInicio + 'T00:00:00') : new Date();
    const diaI = String(dtInicioObj.getDate()).padStart(2, '0');
    const mesI = String(dtInicioObj.getMonth() + 1).padStart(2, '0');
    const anoI = dtInicioObj.getFullYear();
    const dataInicioFormatada = `${diaI}/${mesI}/${anoI}`;

    const mesesDuracao = parseInt(i.prazoContrato || 12);
    const dtFimObj = new Date(dtInicioObj);
    dtFimObj.setMonth(dtFimObj.getMonth() + mesesDuracao);
    
    const diaF = String(dtFimObj.getDate()).padStart(2, '0');
    const mesF = String(dtFimObj.getMonth() + 1).padStart(2, '0');
    const anoF = dtFimObj.getFullYear();
    const dataFimFormatada = `${diaF}/${mesF}/${anoF}`;

    const dataHoje = new Date();
    const dataExtenso = dataHoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const valorFormatado = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(i.valor);

    // --- 2. CONTEÚDO (MUDANÇA CRUCIAL AQUI) ---
    // Removemos a largura fixa em PX. Usamos 100% e deixamos o html2canvas simular a largura.
    const conteudoContrato = `
        <div id="pdf-container" style="width: 100%; padding: 30px; box-sizing: border-box; background-color: white; color: black; font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5;">
            
            <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 25px;">CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL</h3>

            <p style="text-align: justify;">
                <strong>LOCATÁRIO:</strong> <strong>{{INQUILINO}}</strong>, brasileiro(a), portador da cédula de identidade R.G. nº <strong>{{RG}}</strong> e CPF nº <strong>{{CPF}}</strong>.
            </p>

            <p style="text-align: justify;">
                <strong>LOCADOR:</strong> NIELSON FLORÊNCIO DA SILVA, brasileiro, casado, portador da cédula de identidade R.G. n.º 6461460 SDS-PE e CPF n.º 046.304.114-37, residente e domiciliado em Palmares-PE.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA PRIMEIRA:</strong> O objeto deste contrato de locação é o imóvel residencial, situado à <strong>{{ENDERECO}}</strong>.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA SEGUNDA:</strong> O prazo da locação é de <strong>{{PRAZO_MESES}} meses</strong>, iniciando-se em <strong>{{DATA_INICIO}}</strong> com término em <strong>{{DATA_FIM}}</strong>, independentemente de aviso, notificação ou interpelação judicial ou mesmo extrajudicial.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA TERCEIRA:</strong> O aluguel mensal deverá ser pago até o dia <strong>{{DIA_PAGTO}}</strong> do mês subsequente ao vencido, no local indicado pelo LOCADOR, no valor de <strong>{{VALOR}}</strong>.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA QUARTA:</strong> O LOCATÁRIO será responsável por todos os tributos incidentes sobre o imóvel: Contas de luz, de água que serão pagas diretamente às empresas concessionárias dos referidos serviços.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA QUINTA:</strong> Em caso de mora no pagamento do aluguel, será aplicada multa de 2% (dois por cento) sobre o valor devido e juros mensais de 1% (um por cento) do montante devido.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA SEXTA:</strong> Fica ao LOCATÁRIO, a responsabilidade em zelar pela conservação, limpeza do imóvel, efetuando as reformas necessárias para sua manutenção sendo que os gastos e pagamentos decorrentes da mesma, correrão por conta do mesmo. O LOCATÁRIO está obrigado a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura, quando finda ou rescindida esta avença. O LOCATÁRIO não poderá realizar obras que alterem ou modifiquem a estrutura do imóvel locado, sem prévia autorização por escrito do LOCADOR.
            </p>

            <p style="text-align: justify;">
                <strong>PARÁGRAFO ÚNICO:</strong> O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e perfeito funcionamento devendo observar o que consta no termo de vistoria.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA SÉTIMA:</strong> O LOCATÁRIO declara, que o imóvel ora locado, destina-se única e exclusivamente para o seu uso residencial e de sua família.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA OITAVA:</strong> O LOCATÁRIO não poderá sublocar, transferir ou ceder o imóvel, sendo nulo de pleno direito qualquer ato praticado com este fim sem o consentimento prévio e por escrito do LOCADOR.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA NONA:</strong> Em caso de sinistro parcial ou total do prédio, que impossibilite a habitação o imóvel locado, o presente contrato estará rescindido.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA DÉCIMA:</strong> É facultado ao LOCADOR vistoriar, por si ou seus procuradores, sempre que achar conveniente, para a certeza do cumprimento das obrigações assumidas neste contrato.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA DÉCIMA PRIMEIRA:</strong> A infração de qualquer das cláusulas do presente contrato, sujeita o infrator à multa de duas vezes o valor do aluguel.
            </p>

            <p style="text-align: justify;">
                <strong>CLÁUSULA DÉCIMA SEGUNDA:</strong> As partes contratantes obrigam-se por si, herdeiros e/ou sucessores, elegendo o Foro da Cidade de Palmares-PE.
            </p>

            <p style="text-align: justify;">
                E, por assim estarem justos e contratados assinam o presente instrumento em duas (02) vias, para um só efeito.
            </p>

            <br>
            <p style="text-align: right;">Palmares-PE, ${dataExtenso}.</p>
            <br><br>
            
            <div style="width: 100%; text-align: center;">
                <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto 5px auto;"></div>
                <strong>NIELSON FLORENCIO DA SILVA</strong><br>Locador
            </div>
            <br><br>
            <div style="width: 100%; text-align: center;">
                <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto 5px auto;"></div>
                <strong>{{INQUILINO}}</strong><br>Locatário(a)
            </div>
        </div>
    `;

    // --- 3. SUBSTITUIÇÃO ---
    let htmlFinal = conteudoContrato
        .replace(/{{INQUILINO}}/g, (i.inquilino || "___").toUpperCase())
        .replace(/{{RG}}/g, i.rg || "___")
        .replace(/{{CPF}}/g, i.cpf || "___")
        .replace(/{{ENDERECO}}/g, (i.endereco.completo || i.endereco).toUpperCase())
        .replace(/{{VALOR}}/g, valorFormatado)
        .replace(/{{DIA_PAGTO}}/g, i.diaVencimento)
        .replace(/{{PRAZO_MESES}}/g, mesesDuracao)
        .replace(/{{DATA_INICIO}}/g, dataInicioFormatada)
        .replace(/{{DATA_FIM}}/g, dataFimFormatada);

    // --- 4. CONFIGURAÇÃO BLINDADA PARA MOBILE ---
    const opt = {
        margin: [10, 10, 10, 10], 
        filename: `Contrato_${i.inquilino ? i.inquilino.split(' ')[0] : 'Locacao'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            scrollY: 0,
            scrollX: 0,
            // O SEGREDO: Forçamos a "janela virtual" a ter 800px.
            // Assim, o conteúdo "width: 100%" se estica até 800px, ficando perfeito.
            windowWidth: 800,
            width: 800 
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlFinal).save();
}

// --- MÁSCARAS DE INPUT (FORMATAÇÃO AUTOMÁTICA) ---

window.mascaraCPF = (i) => {
    let v = i.value.replace(/\D/g, ""); // Remove tudo que não é dígito
    if (v.length > 11) v = v.slice(0, 11); // Limita a 11 números
    
    // Coloca ponto e traço: 000.000.000-00
    i.value = v.replace(/(\d{3})(\d)/, "$1.$2")
               .replace(/(\d{3})(\d)/, "$1.$2")
               .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

window.mascaraTelefone = (i) => {
    let v = i.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    
    // Coloca parênteses e traço: (00) 00000-0000
    if (v.length > 10) {
        i.value = v.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else {
        i.value = v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    }
}

window.validarDia = (i) => {
    let v = parseInt(i.value);
    if (v < 1) i.value = 1;
    if (v > 31) i.value = 31;
    // Remove caracteres não numéricos
    i.value = i.value.replace(/[^0-9]/g, '');
}

// --- FUNÇÃO DE BACKUP (EXCEL) ---
window.exportarExcel = () => {
    if(todosImoveis.length === 0) return alert("Nenhum imóvel para exportar.");

    // 1. Cabeçalho da Planilha
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nome do Imóvel;Tipo;Valor (R$);Status;Inquilino;CPF;Telefone;Vencimento;Prazo;Inicio Contrato\n";

    // 2. Linhas de Dados
    todosImoveis.forEach(item => {
        const i = item.data;
        
        // Trata campos vazios para não quebrar a planilha
        const nome = i.nome || "-";
        const tipo = i.tipo || "-";
        const valor = (i.valor || 0).toString().replace('.', ','); // Troca ponto por vírgula pro Excel BR
        const status = i.alugado ? "Alugado" : "Livre";
        const inq = i.inquilino || "-";
        const cpf = i.cpf || "-";
        const tel = i.telefone || "-";
        const venc = i.diaVencimento || "-";
        const prazo = i.prazoContrato ? `${i.prazoContrato} meses` : "-";
        
        // Formata data de inicio se existir
        let inicio = "-";
        if(i.dataInicio) {
            const partes = i.dataInicio.split('-'); // aaaa-mm-dd
            inicio = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        // Monta a linha
        csvContent += `${nome};${tipo};${valor};${status};${inq};${cpf};${tel};${venc};${prazo};${inicio}\n`;
    });

    // 3. Download do Arquivo
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Backup_NJ_Imoveis_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
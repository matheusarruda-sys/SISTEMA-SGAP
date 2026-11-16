// =====================================================
// VALIDAÇÃO EM TEMPO REAL
// =====================================================
function definirEstadoCampo(idCampo, idErro, valido, mensagem = "") {
    const campo = document.getElementById(idCampo);
    const textoErro = document.getElementById(idErro);

    if (!campo || !textoErro) return;

    campo.classList.toggle("input-valid", valido);
    campo.classList.toggle("input-error", !valido);
    textoErro.textContent = valido ? "" : mensagem;
    textoErro.classList.toggle("visible", !valido);
}

function formatarCPF(evento) {
    const campo = evento.target;
    campo.value = campo.value
        .replace(/\D/g, "")
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

    validarCPF();
}

function validarCPF() {
    const digitos = document.getElementById("loginDoc").value.replace(/\D/g, "");

    if (!digitos) {
        definirEstadoCampo("loginDoc", "error-loginDoc", false, "O CPF é obrigatório.");
        return false;
    }

    if (digitos.length < 11) {
        definirEstadoCampo("loginDoc", "error-loginDoc", false, `CPF incompleto (${digitos.length}/11 dígitos).`);
        return false;
    }

    definirEstadoCampo("loginDoc", "error-loginDoc", true);
    return true;
}

function validarSenha() {
    const senha = document.getElementById("loginSenha").value;

    if (!senha) {
        definirEstadoCampo("loginSenha", "error-loginSenha", false, "A senha é obrigatória.");
        return false;
    }

    if (senha.trim() !== senha) {
        definirEstadoCampo("loginSenha", "error-loginSenha", false, "Remova espaços em branco no início ou fim da senha.");
        return false;
    }

    if (senha.length < 6) {
        definirEstadoCampo("loginSenha", "error-loginSenha", false, "A senha deve conter pelo menos 6 caracteres.");
        return false;
    }

    definirEstadoCampo("loginSenha", "error-loginSenha", true);
    return true;
}

function alternarVisibilidadeSenha() {
    const campo = document.getElementById("loginSenha");
    const icone = document.getElementById("toggleSenhaIcon");
    const mostrar = campo.type === "password";

    campo.type = mostrar ? "text" : "password";
    icone.setAttribute("data-lucide", mostrar ? "eye-off" : "eye");
    lucide.createIcons();
}

// =====================================================
// POPUP (MODAL) DE ERRO
// =====================================================
function abrirPopupErro(titulo, mensagem) {
    const modal = document.getElementById("errorModal");
    document.getElementById("modalTitle").textContent = titulo;
    document.getElementById("modalMessage").textContent = mensagem;
    modal.classList.add("active");
    document.getElementById("btnCloseModal").focus();
}

function fecharPopupErro() {
    document.getElementById("errorModal").classList.remove("active");
}

document.addEventListener("click", (evento) => {
    if (evento.target.id === "errorModal") fecharPopupErro();
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") fecharPopupErro();
});

// =====================================================
// SISTEMA DE LOGIN COM SUPABASE
// =====================================================
async function fazerLogin(evento) {
    evento.preventDefault();

    const cpfValido = validarCPF();
    const senhaValida = validarSenha();
    if (!cpfValido || !senhaValida) return;

    const cpfFormatado = document.getElementById("loginDoc").value.trim();
    const cpfLimpo = cpfFormatado.replace(/\D/g, "");
    const senhaDigitada = document.getElementById("loginSenha").value;
    const botaoEntrar = document.getElementById("btn-login");

    botaoEntrar.disabled = true;
    botaoEntrar.textContent = "Verificando credenciais...";

    try {
        const { data: usuario, error: erro } = await clienteSupabase
            .from("usuarios")
            .select("id_usuario, nome, id_associacao, cpf, senha, local_residencia, nivel_acesso, bloqueado")
            .or(`cpf.eq.${cpfFormatado},cpf.eq.${cpfLimpo}`)
            .maybeSingle();

        if (erro) {
            console.error("Erro Supabase:", erro);
            abrirPopupErro(
                "Erro de Conexão",
                "Não foi possível consultar o servidor. Verifique sua internet ou as permissões da tabela."
            );
            return;
        }
        if (!usuario || usuario.senha !== senhaDigitada) {
            abrirPopupErro(
                "Credenciais Inválidas",
                "O CPF ou a senha informados estão incorretos. Confira os dados e tente novamente."
            );
            return;
        }
        if (usuario.bloqueado) {
            abrirPopupErro(
                "Acesso Bloqueado",
                "Este usuário encontra-se bloqueado no sistema. Entre em contato com o administrador."
            );
            return;
        }
        // Remove a senha antes de salvar os dados do usuário na sessão
        const { senha, ...dadosSessao } = usuario;
        sessionStorage.setItem("sgap_usuario", JSON.stringify(dadosSessao));

        await registrarLog("SISTEMA", "Autenticação efetuada com sucesso no sistema.", usuario.id_usuario);
        window.location.href = "Inicial.html";

    } catch (erroInesperado) {
        console.error("Erro inesperado:", erroInesperado);
        abrirPopupErro(
            "Erro Inesperado",
            "Ocorreu uma falha interna ao tentar autenticar. Tente novamente em instantes."
        );
    } finally {
        botaoEntrar.disabled = false;
        botaoEntrar.textContent = "Acessar Sistema";
    }
}
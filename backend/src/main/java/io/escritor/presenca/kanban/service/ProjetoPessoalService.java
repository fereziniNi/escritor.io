package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/** Obtém (criando na primeira vez) o projeto pessoal do usuário - um só por usuário. */
@Service
public class ProjetoPessoalService {

    private final ProjetoRepository projetoRepository;
    private final CriadorProjetoPessoal criador;

    public ProjetoPessoalService(ProjetoRepository projetoRepository, CriadorProjetoPessoal criador) {
        this.projetoRepository = projetoRepository;
        this.criador = criador;
    }

    public Projeto obterOuCriar(Usuario usuario) {
        return projetoRepository.findByPessoalDe(usuario).orElseGet(() -> criarOuReler(usuario));
    }

    private Projeto criarOuReler(Usuario usuario) {
        try {
            return criador.criar(usuario);
        } catch (DataIntegrityViolationException corrida) {
            // Duas primeiras tarefas simultâneas: o índice único barrou a segunda criação - a
            // transação REQUIRES_NEW já terminou, então relê o projeto da vencedora.
            return projetoRepository.findByPessoalDe(usuario).orElseThrow(() -> corrida);
        }
    }
}

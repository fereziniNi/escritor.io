package io.escritor.presenca.ponto.repository;

import io.escritor.presenca.ponto.domain.RegistroPonto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegistroPontoRepository extends JpaRepository<RegistroPonto, Long> {
}
